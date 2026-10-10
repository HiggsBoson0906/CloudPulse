import * as checksRepo from "../db/repositories/checks.repo";
import * as metricsRepo from "../db/repositories/metrics.repo";
import * as servicesRepo from "../db/repositories/services.repo";
import * as incidentsRepo from "../db/repositories/incidents.repo";
import * as alertsRepo from "../db/repositories/alerts.repo";
import { cacheService } from "../redis/cache.service";
import { DashboardSummary, MetricWindow, ServiceMetrics } from "../types/metric.types";
import { HealthCheckResult } from "../types/check.types";

export async function getServiceMetrics(
  serviceId: string,
  window: MetricWindow = "15m"
): Promise<ServiceMetrics> {
  const windowMinutes = window === "15m" ? 15 : window === "1h" ? 60 : 1440;
  return metricsRepo.computeLiveMetrics(serviceId, windowMinutes);
}

export async function getRecentServiceChecks(
  serviceId: string,
  limit = 50
): Promise<HealthCheckResult[]> {
  return checksRepo.getRecentChecks(serviceId, limit);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  // Check Redis cache first
  const cached = await cacheService.getDashboardSummary<DashboardSummary>();
  if (cached) {
    return cached;
  }

  const allServices = await servicesRepo.listServices();
  const totalServices = allServices.length;
  const enabledServices = allServices.filter(function (s) { return s.isEnabled; }).length;

  let healthyCount = 0;
  let degradedCount = 0;
  let failingCount = 0;
  let totalSuccessRatio = 0;
  let evaluatedServices = 0;

  for (const s of allServices) {
    const metrics = await metricsRepo.computeLiveMetrics(s.id, 15);
    if (metrics.totalChecks > 0) {
      evaluatedServices++;
      const avail = metrics.availabilityPercent ?? 100;
      totalSuccessRatio += avail;

      if (avail >= 99) {
        healthyCount++;
      } else if (avail >= 90) {
        degradedCount++;
      } else {
        failingCount++;
      }
    }
  }

  const openIncidents = await incidentsRepo.listIncidents({ status: "OPEN" });
  const activeAlerts = await alertsRepo.listAlerts({ status: "firing" });

  const overallAvailabilityPercent =
    evaluatedServices > 0 ? Math.round((totalSuccessRatio / evaluatedServices) * 100) / 100 : null;

  const summary: DashboardSummary = {
    totalServices,
    enabledServices,
    healthyServices: healthyCount,
    degradedServices: degradedCount,
    failingServices: failingCount,
    activeIncidentsCount: openIncidents.length,
    activeAlertsCount: activeAlerts.length,
    overallAvailabilityPercent,
    timestamp: new Date().toISOString(),
  };

  // Cache summary for 30 seconds
  await cacheService.setDashboardSummary(summary, 30);
  return summary;
}
