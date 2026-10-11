import dotenv from "dotenv";

// Load .env if present
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  serviceName: string;
  databaseUrl: string;
  redisUrl: string;
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
    healthTopic: string;
    dlqTopic: string;
  };
  monitoring: {
    loopIntervalMs: number;
    concurrency: number;
    defaultTimeoutMs: number;
    allowPrivateTargets: boolean;
    allowedPrivateHosts: string[];
  };
  auth: {
    adminKey: string;
    operatorKey: string;
    viewerKey: string;
  };
  cors: {
    allowedOrigins: string[];
  };
}

function parseList(val?: string): string[] {
  if (!val) return [];
  return val
    .split(",")
    .map(function (b) {
      return b.trim().toLowerCase();
    })
    .filter(Boolean);
}

function parseBrokers(val?: string): string[] {
  if (!val) return ["localhost:9092"];
  return val
    .split(",")
    .map(function (b) {
      return b.trim();
    })
    .filter(Boolean);
}

const isProduction = (process.env.NODE_ENV || "development") === "production";

export const config: AppConfig = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  serviceName: process.env.SERVICE_NAME || "cloudpulse",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/cloudpulse",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  kafka: {
    brokers: parseBrokers(process.env.KAFKA_BROKERS),
    clientId: process.env.KAFKA_CLIENT_ID || "cloudpulse",
    groupId: process.env.KAFKA_GROUP_ID || "cloudpulse-event-processor",
    healthTopic: process.env.KAFKA_HEALTH_TOPIC || "cloudpulse.health-checks.v1",
    dlqTopic: process.env.KAFKA_DLQ_TOPIC || "cloudpulse.health-checks.dlq",
  },
  monitoring: {
    loopIntervalMs: process.env.WORKER_CHECK_INTERVAL_MS
      ? parseInt(process.env.WORKER_CHECK_INTERVAL_MS, 10)
      : 5000,
    concurrency: process.env.WORKER_CONCURRENCY
      ? parseInt(process.env.WORKER_CONCURRENCY, 10)
      : 10,
    defaultTimeoutMs: process.env.DEFAULT_TIMEOUT_MS
      ? parseInt(process.env.DEFAULT_TIMEOUT_MS, 10)
      : 5000,
    // Production strictly disallows blanket private-target access; only explicit allowedPrivateHosts are permitted
    allowPrivateTargets: isProduction
      ? false
      : process.env.ALLOW_PRIVATE_TARGETS === "true",
    allowedPrivateHosts: parseList(process.env.ALLOWED_PRIVATE_HOSTS),
  },
  auth: {
    adminKey:
      process.env.CLOUDPULSE_ADMIN_API_KEY ||
      process.env.ADMIN_API_KEY ||
      (isProduction ? "" : "cp-admin-dev-key-32chars-prod-ready"),
    operatorKey:
      process.env.CLOUDPULSE_OPERATOR_API_KEY ||
      process.env.OPERATOR_API_KEY ||
      (isProduction ? "" : "cp-operator-dev-key-32chars-prod"),
    viewerKey:
      process.env.CLOUDPULSE_VIEWER_API_KEY ||
      process.env.VIEWER_API_KEY ||
      (isProduction ? "" : "cp-viewer-dev-key-32chars-prod-re"),
  },
  cors: {
    allowedOrigins: parseList(process.env.CORS_ALLOWED_ORIGINS || "*"),
  },
};
