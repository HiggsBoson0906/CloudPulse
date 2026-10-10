import { query } from "../pool";
import { CreateHealthCheckInput, HealthCheckResult, HealthCheckRow } from "../../types/check.types";

export function mapRowToCheck(row: HealthCheckRow): HealthCheckResult {
  return {
    id: row.id,
    serviceId: row.service_id,
    checkTimestamp: row.check_timestamp.toISOString(),
    statusCode: row.status_code,
    latencyMs: row.latency_ms,
    isSuccess: row.is_success,
    failureReason: row.failure_reason,
    createdAt: row.created_at.toISOString(),
  };
}

export async function recordHealthCheck(input: CreateHealthCheckInput): Promise<HealthCheckResult | null> {
  const sql = `
    INSERT INTO health_check_results (
      service_id,
      check_timestamp,
      status_code,
      latency_ms,
      is_success,
      failure_reason
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (service_id, check_timestamp) DO NOTHING
    RETURNING
      id,
      service_id,
      check_timestamp,
      status_code,
      latency_ms,
      is_success,
      failure_reason,
      created_at;
  `;

  const params: unknown[] = [
    input.serviceId,
    input.checkTimestamp,
    input.statusCode,
    input.latencyMs,
    input.isSuccess,
    input.failureReason,
  ];

  const result = await query<HealthCheckRow>(sql, params);
  if (result.rows.length === 0) return null;
  return mapRowToCheck(result.rows[0]);
}

export async function getRecentChecks(serviceId: string, limit = 50): Promise<HealthCheckResult[]> {
  const sql = `
    SELECT
      id,
      service_id,
      check_timestamp,
      status_code,
      latency_ms,
      is_success,
      failure_reason,
      created_at
    FROM health_check_results
    WHERE service_id = $1
    ORDER BY check_timestamp DESC
    LIMIT $2;
  `;

  const result = await query<HealthCheckRow>(sql, [serviceId, limit]);
  return result.rows.map(mapRowToCheck);
}

export async function getChecksInWindow(
  serviceId: string,
  from: Date,
  to: Date
): Promise<HealthCheckResult[]> {
  const sql = `
    SELECT
      id,
      service_id,
      check_timestamp,
      status_code,
      latency_ms,
      is_success,
      failure_reason,
      created_at
    FROM health_check_results
    WHERE service_id = $1
      AND check_timestamp >= $2
      AND check_timestamp <= $3
    ORDER BY check_timestamp ASC;
  `;

  const result = await query<HealthCheckRow>(sql, [serviceId, from, to]);
  return result.rows.map(mapRowToCheck);
}
