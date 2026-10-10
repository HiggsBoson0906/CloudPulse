import { query } from "../pool";
import {
  Alert,
  AlertRow,
  AlertRule,
  AlertRuleRow,
  AlertSeverity,
  AlertStatus,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from "../../types/alert.types";

function parseNumeric(val: string | number): number {
  return typeof val === "number" ? val : parseFloat(val);
}

export function mapRowToAlertRule(row: AlertRuleRow): AlertRule {
  return {
    id: row.id,
    serviceId: row.service_id,
    name: row.name,
    ruleType: row.rule_type as AlertRule["ruleType"],
    threshold: parseNumeric(row.threshold),
    windowMinutes: row.window_minutes,
    severity: row.severity as AlertSeverity,
    cooldownMinutes: row.cooldown_minutes,
    isEnabled: row.is_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function mapRowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    ruleId: row.rule_id,
    serviceId: row.service_id,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    message: row.message,
    currentValue: parseNumeric(row.current_value),
    thresholdValue: parseNumeric(row.threshold_value),
    triggeredAt: row.triggered_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createAlertRule(input: CreateAlertRuleInput): Promise<AlertRule> {
  const sql = `
    INSERT INTO alert_rules (
      service_id,
      name,
      rule_type,
      threshold,
      window_minutes,
      severity,
      cooldown_minutes,
      is_enabled
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING
      id,
      service_id,
      name,
      rule_type,
      threshold,
      window_minutes,
      severity,
      cooldown_minutes,
      is_enabled,
      created_at,
      updated_at;
  `;

  const params: unknown[] = [
    input.serviceId ?? null,
    input.name,
    input.ruleType,
    input.threshold,
    input.windowMinutes ?? 5,
    input.severity,
    input.cooldownMinutes ?? 15,
    input.isEnabled ?? true,
  ];

  const result = await query<AlertRuleRow>(sql, params);
  return mapRowToAlertRule(result.rows[0]);
}

export async function listAlertRules(serviceId?: string): Promise<AlertRule[]> {
  let sql = `
    SELECT
      id,
      service_id,
      name,
      rule_type,
      threshold,
      window_minutes,
      severity,
      cooldown_minutes,
      is_enabled,
      created_at,
      updated_at
    FROM alert_rules
  `;

  const params: unknown[] = [];
  if (serviceId) {
    sql += ` WHERE service_id = $1 OR service_id IS NULL`;
    params.push(serviceId);
  }

  sql += ` ORDER BY created_at DESC;`;

  const result = await query<AlertRuleRow>(sql, params);
  return result.rows.map(mapRowToAlertRule);
}

export async function getAlertRuleById(id: string): Promise<AlertRule | null> {
  const sql = `
    SELECT
      id,
      service_id,
      name,
      rule_type,
      threshold,
      window_minutes,
      severity,
      cooldown_minutes,
      is_enabled,
      created_at,
      updated_at
    FROM alert_rules
    WHERE id = $1;
  `;

  const result = await query<AlertRuleRow>(sql, [id]);
  if (result.rows.length === 0) return null;
  return mapRowToAlertRule(result.rows[0]);
}

export async function updateAlertRule(
  id: string,
  input: UpdateAlertRuleInput
): Promise<AlertRule | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    params.push(input.name);
  }

  if (input.threshold !== undefined) {
    setClauses.push(`threshold = $${paramIndex++}`);
    params.push(input.threshold);
  }

  if (input.windowMinutes !== undefined) {
    setClauses.push(`window_minutes = $${paramIndex++}`);
    params.push(input.windowMinutes);
  }

  if (input.severity !== undefined) {
    setClauses.push(`severity = $${paramIndex++}`);
    params.push(input.severity);
  }

  if (input.cooldownMinutes !== undefined) {
    setClauses.push(`cooldown_minutes = $${paramIndex++}`);
    params.push(input.cooldownMinutes);
  }

  if (input.isEnabled !== undefined) {
    setClauses.push(`is_enabled = $${paramIndex++}`);
    params.push(input.isEnabled);
  }

  if (setClauses.length === 0) {
    return getAlertRuleById(id);
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id);
  const idPlaceholder = `$${paramIndex}`;

  const sql = `
    UPDATE alert_rules
    SET ${setClauses.join(", ")}
    WHERE id = ${idPlaceholder}
    RETURNING
      id,
      service_id,
      name,
      rule_type,
      threshold,
      window_minutes,
      severity,
      cooldown_minutes,
      is_enabled,
      created_at,
      updated_at;
  `;

  const result = await query<AlertRuleRow>(sql, params);
  if (result.rows.length === 0) return null;
  return mapRowToAlertRule(result.rows[0]);
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const sql = `DELETE FROM alert_rules WHERE id = $1;`;
  const result = await query(sql, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getActiveFiringAlert(ruleId: string, serviceId: string): Promise<Alert | null> {
  const sql = `
    SELECT
      id,
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value,
      triggered_at,
      resolved_at,
      created_at
    FROM alerts
    WHERE rule_id = $1 AND service_id = $2 AND status = 'firing'
    ORDER BY triggered_at DESC
    LIMIT 1;
  `;

  const result = await query<AlertRow>(sql, [ruleId, serviceId]);
  if (result.rows.length === 0) return null;
  return mapRowToAlert(result.rows[0]);
}

export async function getLatestAlert(ruleId: string, serviceId: string): Promise<Alert | null> {
  const sql = `
    SELECT
      id,
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value,
      triggered_at,
      resolved_at,
      created_at
    FROM alerts
    WHERE rule_id = $1 AND service_id = $2
    ORDER BY triggered_at DESC
    LIMIT 1;
  `;

  const result = await query<AlertRow>(sql, [ruleId, serviceId]);
  if (result.rows.length === 0) return null;
  return mapRowToAlert(result.rows[0]);
}

export async function createAlert(data: {
  ruleId: string;
  serviceId: string;
  severity: AlertSeverity;
  message: string;
  currentValue: number;
  thresholdValue: number;
}): Promise<Alert> {
  const sql = `
    INSERT INTO alerts (
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value
    ) VALUES ($1, $2, $3, 'firing', $4, $5, $6)
    RETURNING
      id,
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value,
      triggered_at,
      resolved_at,
      created_at;
  `;

  const params: unknown[] = [
    data.ruleId,
    data.serviceId,
    data.severity,
    data.message,
    data.currentValue,
    data.thresholdValue,
  ];

  const result = await query<AlertRow>(sql, params);
  return mapRowToAlert(result.rows[0]);
}

export async function resolveAlert(alertId: string): Promise<Alert | null> {
  const sql = `
    UPDATE alerts
    SET status = 'resolved', resolved_at = NOW()
    WHERE id = $1 AND status = 'firing'
    RETURNING
      id,
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value,
      triggered_at,
      resolved_at,
      created_at;
  `;

  const result = await query<AlertRow>(sql, [alertId]);
  if (result.rows.length === 0) return null;
  return mapRowToAlert(result.rows[0]);
}

export async function listAlerts(filter?: {
  serviceId?: string;
  status?: string;
  limit?: number;
}): Promise<Alert[]> {
  const whereClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filter?.serviceId) {
    whereClauses.push(`service_id = $${paramIdx++}`);
    params.push(filter.serviceId);
  }

  if (filter?.status) {
    whereClauses.push(`status = $${paramIdx++}`);
    params.push(filter.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const limitVal = filter?.limit ?? 100;
  params.push(limitVal);
  const limitPlaceholder = `$${paramIdx}`;

  const sql = `
    SELECT
      id,
      rule_id,
      service_id,
      severity,
      status,
      message,
      current_value,
      threshold_value,
      triggered_at,
      resolved_at,
      created_at
    FROM alerts
    ${whereSql}
    ORDER BY triggered_at DESC
    LIMIT ${limitPlaceholder};
  `;

  const result = await query<AlertRow>(sql, params);
  return result.rows.map(mapRowToAlert);
}
