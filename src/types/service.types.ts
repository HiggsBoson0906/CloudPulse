export type ServiceEnvironment = "development" | "staging" | "production";

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

export interface ServiceRow {
  id: string;
  name: string;
  base_url: string;
  health_check_path: string;
  environment: string;
  check_interval_seconds: number;
  timeout_ms: number;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}
