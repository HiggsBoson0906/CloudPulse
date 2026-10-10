import { Request, Response } from "express";
import * as alertsRepo from "../db/repositories/alerts.repo";
import { isValidUUID } from "./services.controller";
import {
  AlertRuleType,
  AlertSeverity,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from "../types/alert.types";

const VALID_RULE_TYPES: readonly AlertRuleType[] = [
  "error_rate",
  "p95_latency",
  "service_down",
  "consecutive_failures",
];

const VALID_SEVERITIES: readonly AlertSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export async function createAlertRuleHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const errors: string[] = [];

    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const name = body.name;
    const ruleType = body.ruleType ?? body.rule_type;
    const threshold = body.threshold;
    const serviceId = body.serviceId ?? body.service_id;
    const windowMinutes = body.windowMinutes ?? body.window_minutes;
    const severity = body.severity;
    const cooldownMinutes = body.cooldownMinutes ?? body.cooldown_minutes;
    const isEnabled = body.isEnabled ?? body.is_enabled;

    if (typeof name !== "string" || name.trim().length === 0) {
      errors.push("Field 'name' is required and must be a non-empty string");
    }

    if (!VALID_RULE_TYPES.includes(ruleType as AlertRuleType)) {
      errors.push(`Field 'ruleType' must be one of: ${VALID_RULE_TYPES.join(", ")}`);
    }

    if (typeof threshold !== "number" || isNaN(threshold) || threshold < 0) {
      errors.push("Field 'threshold' must be a non-negative number");
    }

    if (serviceId !== undefined && serviceId !== null) {
      if (typeof serviceId !== "string" || !isValidUUID(serviceId)) {
        errors.push("Field 'serviceId' must be a valid UUID or null");
      }
    }

    if (windowMinutes !== undefined) {
      if (typeof windowMinutes !== "number" || !Number.isInteger(windowMinutes) || windowMinutes <= 0) {
        errors.push("Field 'windowMinutes' must be a positive integer");
      }
    }

    if (!VALID_SEVERITIES.includes(severity as AlertSeverity)) {
      errors.push(`Field 'severity' must be one of: ${VALID_SEVERITIES.join(", ")}`);
    }

    if (cooldownMinutes !== undefined) {
      if (typeof cooldownMinutes !== "number" || !Number.isInteger(cooldownMinutes) || cooldownMinutes < 0) {
        errors.push("Field 'cooldownMinutes' must be a non-negative integer");
      }
    }

    if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
      errors.push("Field 'isEnabled' must be a boolean");
    }

    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const input: CreateAlertRuleInput = {
      name: (name as string).trim(),
      ruleType: ruleType as AlertRuleType,
      threshold: threshold as number,
      serviceId: (serviceId as string) || null,
      windowMinutes: windowMinutes as number | undefined,
      severity: severity as AlertSeverity,
      cooldownMinutes: cooldownMinutes as number | undefined,
      isEnabled: isEnabled as boolean | undefined,
    };

    const created = await alertsRepo.createAlertRule(input);
    res.status(201).json(created);
  } catch (error: unknown) {
    console.error("[Controller] createAlertRuleHandler failed:", error);
    res.status(500).json({ error: "Failed to create alert rule" });
  }
}

export async function listAlertRulesHandler(req: Request, res: Response): Promise<void> {
  try {
    const serviceId = req.query.serviceId as string | undefined;
    if (serviceId && !isValidUUID(serviceId)) {
      res.status(400).json({ error: "Invalid serviceId query parameter" });
      return;
    }

    const rules = await alertsRepo.listAlertRules(serviceId);
    res.status(200).json(rules);
  } catch (error: unknown) {
    console.error("[Controller] listAlertRulesHandler failed:", error);
    res.status(500).json({ error: "Failed to list alert rules" });
  }
}

export async function getAlertRuleByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid alert rule ID" });
      return;
    }

    const rule = await alertsRepo.getAlertRuleById(id);
    if (!rule) {
      res.status(404).json({ error: `Alert rule with ID '${id}' not found` });
      return;
    }

    res.status(200).json(rule);
  } catch (error: unknown) {
    console.error("[Controller] getAlertRuleByIdHandler failed:", error);
    res.status(500).json({ error: "Failed to retrieve alert rule" });
  }
}

export async function updateAlertRuleHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid alert rule ID" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Request body must be a JSON object" });
      return;
    }

    const errors: string[] = [];
    const updateInput: UpdateAlertRuleInput = {};
    let fieldsProvided = 0;

    const name = body.name;
    const threshold = body.threshold;
    const windowMinutes = body.windowMinutes ?? body.window_minutes;
    const severity = body.severity;
    const cooldownMinutes = body.cooldownMinutes ?? body.cooldown_minutes;
    const isEnabled = body.isEnabled ?? body.is_enabled;

    if (name !== undefined) {
      fieldsProvided++;
      if (typeof name !== "string" || name.trim().length === 0) {
        errors.push("Field 'name' must be a non-empty string");
      } else {
        updateInput.name = name.trim();
      }
    }

    if (threshold !== undefined) {
      fieldsProvided++;
      if (typeof threshold !== "number" || isNaN(threshold) || threshold < 0) {
        errors.push("Field 'threshold' must be a non-negative number");
      } else {
        updateInput.threshold = threshold;
      }
    }

    if (windowMinutes !== undefined) {
      fieldsProvided++;
      if (typeof windowMinutes !== "number" || !Number.isInteger(windowMinutes) || windowMinutes <= 0) {
        errors.push("Field 'windowMinutes' must be a positive integer");
      } else {
        updateInput.windowMinutes = windowMinutes;
      }
    }

    if (severity !== undefined) {
      fieldsProvided++;
      if (!VALID_SEVERITIES.includes(severity as AlertSeverity)) {
        errors.push(`Field 'severity' must be one of: ${VALID_SEVERITIES.join(", ")}`);
      } else {
        updateInput.severity = severity as AlertSeverity;
      }
    }

    if (cooldownMinutes !== undefined) {
      fieldsProvided++;
      if (typeof cooldownMinutes !== "number" || !Number.isInteger(cooldownMinutes) || cooldownMinutes < 0) {
        errors.push("Field 'cooldownMinutes' must be a non-negative integer");
      } else {
        updateInput.cooldownMinutes = cooldownMinutes;
      }
    }

    if (isEnabled !== undefined) {
      fieldsProvided++;
      if (typeof isEnabled !== "boolean") {
        errors.push("Field 'isEnabled' must be a boolean");
      } else {
        updateInput.isEnabled = isEnabled;
      }
    }

    if (fieldsProvided === 0) {
      res.status(400).json({ error: "At least one update field must be provided" });
      return;
    }

    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const updated = await alertsRepo.updateAlertRule(id, updateInput);
    if (!updated) {
      res.status(404).json({ error: `Alert rule with ID '${id}' not found` });
      return;
    }

    res.status(200).json(updated);
  } catch (error: unknown) {
    console.error("[Controller] updateAlertRuleHandler failed:", error);
    res.status(500).json({ error: "Failed to update alert rule" });
  }
}

export async function deleteAlertRuleHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === "string" ? rawId : "";

    if (!isValidUUID(id)) {
      res.status(400).json({ error: "Invalid alert rule ID" });
      return;
    }

    const deleted = await alertsRepo.deleteAlertRule(id);
    if (!deleted) {
      res.status(404).json({ error: `Alert rule with ID '${id}' not found` });
      return;
    }

    res.status(204).send();
  } catch (error: unknown) {
    console.error("[Controller] deleteAlertRuleHandler failed:", error);
    res.status(500).json({ error: "Failed to delete alert rule" });
  }
}

export async function listAlertsHandler(req: Request, res: Response): Promise<void> {
  try {
    const serviceId = req.query.serviceId as string | undefined;
    const status = req.query.status as string | undefined;

    if (serviceId && !isValidUUID(serviceId)) {
      res.status(400).json({ error: "Invalid serviceId parameter" });
      return;
    }

    const alerts = await alertsRepo.listAlerts({ serviceId, status });
    res.status(200).json(alerts);
  } catch (error: unknown) {
    console.error("[Controller] listAlertsHandler failed:", error);
    res.status(500).json({ error: "Failed to list alerts" });
  }
}
