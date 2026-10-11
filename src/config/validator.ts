import { config } from "./index";
import { logger } from "../utils/logger";

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
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
    } else if (config.auth.adminKey.length < 16) {
      errors.push("CLOUDPULSE_ADMIN_API_KEY must be at least 16 characters in production");
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
