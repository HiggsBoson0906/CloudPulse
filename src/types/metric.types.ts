export type MetricWindow = "15m" | "1h" | "24h";

export interface ServiceMetrics {
  serviceId: string;
  window: MetricWindow;
  windowStart: string;
  windowEnd: string;
  totalChecks: number;
  successCount: number;
  failureCount: number;
  availabilityPercent: number | null;
  errorRatePercent: number;
  avgLatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
}

export interface MetricAggregateRow {
  id: string;
  service_id: string;
  window_type: string;
  window_start: Date;
  window_end: Date;
  total_checks: number;
  success_count: number;
  failure_count: number;
  error_rate: string | number;
  avg_latency_ms: string | number;
  p95_latency_ms: string | number;
  p99_latency_ms: string | number;
  created_at: Date;
}

export interface DashboardSummary {
  totalServices: number;
  enabledServices: number;
  healthyServices: number;
  degradedServices: number;
  failingServices: number;
  activeIncidentsCount: number;
  activeAlertsCount: number;
  overallAvailabilityPercent: number | null;
  timestamp: string;
}
