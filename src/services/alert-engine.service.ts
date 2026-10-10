import * as alertsRepo from "../db/repositories/alerts.repo";
import * as incidentsRepo from "../db/repositories/incidents.repo";
import * as metricsRepo from "../db/repositories/metrics.repo";
import * as checksRepo from "../db/repositories/checks.repo";
import { AlertRule } from "../types/alert.types";
import { HealthCheckEventPayload } from "../types/event.types";
import { logger } from "../utils/logger";

export function isAlertWithinCooldown(
  latestAlert: { triggeredAt: string; resolvedAt: string | null },
  cooldownMinutes: number,
  nowMs: number = Date.now()
): boolean {
  if (cooldownMinutes <= 0) return false;
  // If the alert was resolved, cooldown is calculated from the resolution/recovery time
  // to prevent flapping immediately after recovery.
  // Otherwise, fallback to triggeredAt.
  const referenceTime = latestAlert.resolvedAt
    ? new Date(latestAlert.resolvedAt).getTime()
    : new Date(latestAlert.triggeredAt).getTime();

  const elapsedMs = nowMs - referenceTime;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return elapsedMs < cooldownMs;
}

export async function evaluateAlertRulesForCheck(payload: HealthCheckEventPayload): Promise<void> {
  const { serviceId } = payload;

  // Retrieve applicable active rules (both service-specific and global)
  const rules = await alertsRepo.listAlertRules(serviceId);
  const activeRules = rules.filter(function (r) {
    return r.isEnabled && (r.serviceId === null || r.serviceId === serviceId);
  });

  if (activeRules.length === 0) return;

  for (const rule of activeRules) {
    try {
      await evaluateSingleRule(rule, payload);
    } catch (ruleErr: unknown) {
      logger.error("AlertEngine", `Failed evaluating rule ${rule.name} (${rule.id}):`, ruleErr);
    }
  }
}

async function evaluateSingleRule(rule: AlertRule, payload: HealthCheckEventPayload): Promise<void> {
  const { serviceId } = payload;
  let isViolated = false;
  let currentValue = 0;
  let violationMessage = "";

  if (rule.ruleType === "error_rate") {
    const metrics = await metricsRepo.computeLiveMetrics(serviceId, rule.windowMinutes);
    currentValue = metrics.errorRatePercent;
    if (metrics.totalChecks >= 3 && currentValue > rule.threshold) {
      isViolated = true;
      violationMessage = `Error rate of ${currentValue}% exceeds threshold of ${rule.threshold}% over ${rule.windowMinutes}m window`;
    }
  } else if (rule.ruleType === "p95_latency") {
    const metrics = await metricsRepo.computeLiveMetrics(serviceId, rule.windowMinutes);
    currentValue = metrics.p95LatencyMs ?? 0;
    if (metrics.totalChecks >= 3 && currentValue > rule.threshold) {
      isViolated = true;
      violationMessage = `P95 latency of ${currentValue}ms exceeds threshold of ${rule.threshold}ms over ${rule.windowMinutes}m window`;
    }
  } else if (rule.ruleType === "consecutive_failures" || rule.ruleType === "service_down") {
    const recent = await checksRepo.getRecentChecks(serviceId, Math.max(10, Math.round(rule.threshold)));
    let consecutiveFails = 0;
    for (const check of recent) {
      if (!check.isSuccess) {
        consecutiveFails++;
      } else {
        break;
      }
    }
    currentValue = consecutiveFails;
    if (consecutiveFails >= rule.threshold) {
      isViolated = true;
      violationMessage = `Service has failed ${consecutiveFails} consecutive health checks (threshold: ${rule.threshold})`;
    }
  }

  // Check if an alert is already firing
  const existingFiringAlert = await alertsRepo.getActiveFiringAlert(rule.id, serviceId);

  if (isViolated) {
    if (existingFiringAlert) {
      // Deduplication: do not generate a duplicate alert while already firing
      logger.debug("AlertEngine", `Alert for rule '${rule.name}' on service ${serviceId} already firing. Skipping.`);
      return;
    }

    // Cooldown: prevent flapping if an alert for this rule was triggered or resolved recently
    if (rule.cooldownMinutes > 0) {
      const latestAlert = await alertsRepo.getLatestAlert(rule.id, serviceId);
      if (latestAlert && isAlertWithinCooldown(latestAlert, rule.cooldownMinutes)) {
        logger.debug(
          "AlertEngine",
          `Alert for rule '${rule.name}' on service ${serviceId} within cooldown window (${rule.cooldownMinutes}m). Skipping.`
        );
        return;
      }
    }

    // Trigger new alert
    logger.warn("AlertEngine", `TRIGGERING ALERT: [${rule.severity.toUpperCase()}] ${rule.name}: ${violationMessage}`);
    const alert = await alertsRepo.createAlert({
      ruleId: rule.id,
      serviceId,
      severity: rule.severity,
      message: violationMessage,
      currentValue,
      thresholdValue: rule.threshold,
    });

    // Group into an active Incident
    let incident = await incidentsRepo.getOpenIncidentForService(serviceId);
    if (!incident) {
      incident = await incidentsRepo.createIncident({
        serviceId,
        title: `Service Degradation: ${rule.name}`,
        severity: rule.severity,
        summary: violationMessage,
      });
      logger.warn("AlertEngine", `Created new incident ${incident.id} for service ${serviceId}`);
    }

    await incidentsRepo.linkAlertToIncident(incident.id, alert.id);
  } else {
    // Condition is currently healthy: check if we should auto-resolve an active firing alert
    if (existingFiringAlert) {
      logger.info("AlertEngine", `RESOLVING ALERT: [${existingFiringAlert.id}] Rule '${rule.name}' condition recovered.`);
      await alertsRepo.resolveAlert(existingFiringAlert.id);
    }
  }
}
