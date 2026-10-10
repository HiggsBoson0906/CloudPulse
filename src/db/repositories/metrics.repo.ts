import { query } from "../pool";
import { MetricAggregateRow, MetricWindow, ServiceMetrics } from "../../types/metric.types";
import { computeAvailability, computeErrorRate, computeLatencyMetrics } from "../../utils/metrics-calculator";

function parseNumeric(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(val);
}

export function mapRowToMetrics(row: MetricAggregateRow): ServiceMetrics {
  const total = row.total_checks;
  const successes = row.success_count;
  return {
    serviceId: row.service_id,
    window: row.window_type as MetricWindow,
    windowStart: row.window_start.toISOString(),
    windowEnd: row.window_end.toISOString(),
    totalChecks: total,
    successCount: successes,
    failureCount: row.failure_count,
    availabilityPercent: computeAvailability(total, successes),
    errorRatePercent: parseNumeric(row.error_rate),
    avgLatencyMs: parseNumeric(row.avg_latency_ms),
    p95LatencyMs: parseNumeric(row.p95_latency_ms),
    p99LatencyMs: parseNumeric(row.p99_latency_ms),
  };
}

export async function computeLiveMetrics(
  serviceId: string,
  windowMinutes: number
): Promise<ServiceMetrics> {
  const windowType: MetricWindow = windowMinutes <= 15 ? "15m" : windowMinutes <= 60 ? "1h" : "24h";
  const now = new Date();
  const startTime = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Retrieve raw checks within the timeframe
  const sql = `
    SELECT latency_ms, is_success
    FROM health_check_results
    WHERE service_id = $1
      AND check_timestamp >= $2
    ORDER BY check_timestamp ASC;
  `;

  const result = await query<{ latency_ms: number; is_success: boolean }>(sql, [serviceId, startTime]);

  const totalChecks = result.rows.length;
  if (totalChecks === 0) {
    return {
      serviceId,
      window: windowType,
      windowStart: startTime.toISOString(),
      windowEnd: now.toISOString(),
      totalChecks: 0,
      successCount: 0,
      failureCount: 0,
      availabilityPercent: null,
      errorRatePercent: 0,
      avgLatencyMs: null,
      p95LatencyMs: null,
      p99LatencyMs: null,
    };
  }

  let successCount = 0;
  let failureCount = 0;
  const latencies: number[] = [];

  for (const row of result.rows) {
    if (row.is_success) {
      successCount++;
    } else {
      failureCount++;
    }
    latencies.push(row.latency_ms);
  }

  const { p95, p99, avg } = computeLatencyMetrics(latencies);
  const availabilityPercent = computeAvailability(totalChecks, successCount);
  const errorRatePercent = computeErrorRate(totalChecks, failureCount);

  return {
    serviceId,
    window: windowType,
    windowStart: startTime.toISOString(),
    windowEnd: now.toISOString(),
    totalChecks,
    successCount,
    failureCount,
    availabilityPercent,
    errorRatePercent,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    p99LatencyMs: p99,
  };
}

export async function upsertMetricAggregate(metrics: ServiceMetrics): Promise<void> {
  const sql = `
    INSERT INTO metric_aggregates (
      service_id,
      window_type,
      window_start,
      window_end,
      total_checks,
      success_count,
      failure_count,
      error_rate,
      avg_latency_ms,
      p95_latency_ms,
      p99_latency_ms
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (service_id, window_type, window_start)
    DO UPDATE SET
      total_checks = EXCLUDED.total_checks,
      success_count = EXCLUDED.success_count,
      failure_count = EXCLUDED.failure_count,
      error_rate = EXCLUDED.error_rate,
      avg_latency_ms = EXCLUDED.avg_latency_ms,
      p95_latency_ms = EXCLUDED.p95_latency_ms,
      p99_latency_ms = EXCLUDED.p99_latency_ms;
  `;

  const params: unknown[] = [
    metrics.serviceId,
    metrics.window,
    metrics.windowStart,
    metrics.windowEnd,
    metrics.totalChecks,
    metrics.successCount,
    metrics.failureCount,
    metrics.errorRatePercent,
    metrics.avgLatencyMs ?? 0,
    metrics.p95LatencyMs ?? 0,
    metrics.p99LatencyMs ?? 0,
  ];

  await query(sql, params);
}
