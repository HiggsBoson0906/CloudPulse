export type ServiceEnvironment = "development" | "staging" | "production";

export interface ServiceRecord {
  id: string;
  name: string;
  baseUrl: string;
  healthCheckPath: string;
  environment: ServiceEnvironment;
  checkIntervalSeconds: number;
  timeoutMs: number;
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
}

export interface UpdateServiceInput {
  name?: string;
  baseUrl?: string;
  healthCheckPath?: string;
  environment?: ServiceEnvironment;
  checkIntervalSeconds?: number;
  timeoutMs?: number;
}

export interface ServiceRow {
  id: string;
  name: string;
  base_url: string;
  health_check_path: string;
  environment: string;
  check_interval_seconds: number;
  timeout_ms: number;
  created_at: Date;
  updated_at: Date;
}
