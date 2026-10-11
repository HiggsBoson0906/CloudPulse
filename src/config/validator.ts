import { config } from "./index";
import { logger } from "../utils/logger";

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const KNOWN_INSECURE_KEYS = new Set([
  "cp-admin-dev-key",
  "cp-admin-dev-key-32chars-prod-ready",
  "cp-operator-dev-key",
  "cp-operator-dev-key-32chars-prod",
  "cp-viewer-dev-key",
  "cp-viewer-dev-key-32chars-prod-re",
  "admin",
  "password",
  "secret",
  "changeme",
  "12345678",
  "default",
]);

export function isKnownInsecureKey(key: string): boolean {
  if (!key) return false;
  const normalized = key.trim().toLowerCase();
  if (KNOWN_INSECURE_KEYS.has(normalized)) return true;
  if (
    normalized.startsWith("cp-admin-dev-key") ||
    normalized.startsWith("cp-operator-dev-key") ||
    normalized.startsWith("cp-viewer-dev-key")
  ) {
    return true;
  }
  return false;
}

/**
 * Validates system configuration before accepting traffic or starting workers.
 * In production, enforces strict secret requirements and disallows insecure defaults.
 */
export function validateSystemConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.nodeEnv === "production";

  if (isProduction) {
    // 1. Mandatory Admin API Key in production
    if (!config.auth.adminKey || config.auth.adminKey.trim().length === 0) {
      errors.push("CLOUDPULSE_ADMIN_API_KEY must be set in production mode");
    } else if (config.auth.adminKey.length < 32) {
      errors.push("CLOUDPULSE_ADMIN_API_KEY must be at least 32 characters in production");
    } else if (isKnownInsecureKey(config.auth.adminKey)) {
      errors.push(
        "CLOUDPULSE_ADMIN_API_KEY cannot use known development/insecure default keys in production"
      );
    }

    if (config.auth.operatorKey) {
      if (config.auth.operatorKey.length < 32) {
        errors.push("CLOUDPULSE_OPERATOR_API_KEY must be at least 32 characters in production");
      } else if (isKnownInsecureKey(config.auth.operatorKey)) {
        errors.push("CLOUDPULSE_OPERATOR_API_KEY cannot use known development/insecure default keys in production");
      }
    }

    if (config.auth.viewerKey) {
      if (config.auth.viewerKey.length < 32) {
        errors.push("CLOUDPULSE_VIEWER_API_KEY must be at least 32 characters in production");
      } else if (isKnownInsecureKey(config.auth.viewerKey)) {
        errors.push("CLOUDPULSE_VIEWER_API_KEY cannot use known development/insecure default keys in production");
      }
    }

    // 2. Reject default insecure postgres credentials in production
    if (
      config.databaseUrl.includes("postgres:postgres@localhost") ||
      (config.databaseUrl.includes("postgres:postgres@") && process.env.STRICT_PRODUCTION === "true")
    ) {
      errors.push(
        "DATABASE_URL uses default/insecure credentials ('postgres:postgres@') in strict production mode"
      );
    }

    // 3. Strict private targets check: never permit blanket private targets in production
    if (config.monitoring.allowPrivateTargets) {
      errors.push(
        "ALLOW_PRIVATE_TARGETS must not be enabled in production; use ALLOWED_PRIVATE_HOSTS instead"
      );
    }
  } else {
    // Development / test warnings
    if (!process.env.CLOUDPULSE_ADMIN_API_KEY && !process.env.ADMIN_API_KEY) {
      warnings.push(
        "Using fallback development admin key ('cp-admin-dev-key-32chars-prod-ready'). Set CLOUDPULSE_ADMIN_API_KEY for production."
      );
    }
    if (config.monitoring.allowPrivateTargets) {
      warnings.push(
        "ALLOW_PRIVATE_TARGETS is enabled for development/testing. Do not use in production."
      );
    }
  }

  // Common checks across all environments
  if (!config.databaseUrl) {
    errors.push("DATABASE_URL is required");
  }
  if (!config.kafka.brokers || config.kafka.brokers.length === 0) {
    errors.push("KAFKA_BROKERS must contain at least one broker address");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates config on startup. Logs warnings and throws a fatal error if invalid in production.
 */
export function enforceStartupConfig(): void {
  const result = validateSystemConfig();

  for (const warning of result.warnings) {
    logger.warn("ConfigValidator", warning);
  }

  if (!result.isValid) {
    for (const error of result.errors) {
      logger.error("ConfigValidator", `Startup configuration error: ${error}`);
    }
    throw new Error(
      `Fatal configuration validation failure:\n  - ${result.errors.join("\n  - ")}`
    );
  }

  logger.info("ConfigValidator", `Configuration verified for environment '${config.nodeEnv}'`);
}
