export type ServiceEnvironment = 'development' | 'staging' | 'production';

export interface ServiceRecord {
  id: string;
  name: string;
  baseUrl: string;
  healthCheckPath: string;
  environment: ServiceEnvironment;
  checkIntervalSeconds: number;
  timeoutMs: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  name: string;
  baseUrl: string;
  healthCheckPath?: string;
  environment: ServiceEnvironment;
  checkIntervalSeconds?: number;
  timeoutMs?: number;
  isEnabled?: boolean;
}

export interface UpdateServiceInput {
  name?: string;
  baseUrl?: string;
  healthCheckPath?: string;
  environment?: ServiceEnvironment;
  checkIntervalSeconds?: number;
  timeoutMs?: number;
  isEnabled?: boolean;
}

export interface HealthCheckResult {
  id: string;
  serviceId: string;
  checkTimestamp: string;
  isSuccess: boolean;
  statusCode: number | null;
  latencyMs: number;
  failureReason: string | null;
  createdAt: string;
  // Optional aliases for defensive compatibility
  responseTimeMs?: number;
  errorMessage?: string | null;
}

export function getCheckLatency(check?: HealthCheckResult | null): number | null {
  if (!check) return null;
  const val = check.latencyMs ?? check.responseTimeMs;
  if (typeof val === 'number' && !isNaN(val) && val >= 0) {
    return val;
  }
  return null;
}

export function getCheckError(check?: HealthCheckResult | null): string | null {
  if (!check) return null;
  return check.failureReason ?? check.errorMessage ?? null;
}


export type MetricWindow = '15m' | '1h' | '24h';

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

export type AlertRuleType =
  | 'error_rate'
  | 'p95_latency'
  | 'service_down'
  | 'consecutive_failures';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRule {
  id: string;
  serviceId: string | null;
  name: string;
  ruleType: AlertRuleType;
  threshold: number;
  windowMinutes: number;
  severity: AlertSeverity;
  cooldownMinutes: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  name: string;
  ruleType: AlertRuleType;
  threshold: number;
  serviceId?: string | null;
  windowMinutes?: number;
  severity: AlertSeverity;
  cooldownMinutes?: number;
  isEnabled?: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  serviceId: string;
  severity: AlertSeverity;
  status: 'firing' | 'resolved';
  message: string;
  currentValue: number;
  thresholdValue: number;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Incident {
  id: string;
  serviceId: string;
  title: string;
  status: IncidentStatus;
  severity: AlertSeverity;
  summary: string | null;
  openedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alerts: string[];
}
