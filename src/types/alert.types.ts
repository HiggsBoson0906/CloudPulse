export type AlertRuleType =
  | "error_rate"
  | "p95_latency"
  | "service_down"
  | "consecutive_failures";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "firing" | "resolved";

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
  serviceId?: string | null;
  name: string;
  ruleType: AlertRuleType;
  threshold: number;
  windowMinutes?: number;
  severity: AlertSeverity;
  cooldownMinutes?: number;
  isEnabled?: boolean;
}

export interface UpdateAlertRuleInput {
  name?: string;
  threshold?: number;
  windowMinutes?: number;
  severity?: AlertSeverity;
  cooldownMinutes?: number;
  isEnabled?: boolean;
}

export interface AlertRuleRow {
  id: string;
  service_id: string | null;
  name: string;
  rule_type: string;
  threshold: string | number;
  window_minutes: number;
  severity: string;
  cooldown_minutes: number;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  ruleId: string;
  serviceId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  currentValue: number;
  thresholdValue: number;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AlertRow {
  id: string;
  rule_id: string;
  service_id: string;
  severity: string;
  status: string;
  message: string;
  current_value: string | number;
  threshold_value: string | number;
  triggered_at: Date;
  resolved_at: Date | null;
  created_at: Date;
}
