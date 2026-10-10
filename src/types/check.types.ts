export interface HealthCheckResult {
  id: string;
  serviceId: string;
  checkTimestamp: string;
  statusCode: number | null;
  latencyMs: number;
  isSuccess: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface HealthCheckRow {
  id: string;
  service_id: string;
  check_timestamp: Date;
  status_code: number | null;
  latency_ms: number;
  is_success: boolean;
  failure_reason: string | null;
  created_at: Date;
}

export interface CreateHealthCheckInput {
  serviceId: string;
  checkTimestamp: string;
  statusCode: number | null;
  latencyMs: number;
  isSuccess: boolean;
  failureReason: string | null;
}
