type LogLevel = "info" | "warn" | "error" | "debug";

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "credential",
  "access_token",
];

export function sanitizeLogData(data: unknown): unknown {
  if (typeof data !== "object" || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some(function (sensitive) {
      return key.toLowerCase().includes(sensitive);
    });

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function logMessage(level: LogLevel, context: string, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString();
  const safeMeta = meta !== undefined ? sanitizeLogData(meta) : "";
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;

  if (level === "error") {
    console.error(prefix, message, safeMeta);
  } else if (level === "warn") {
    console.warn(prefix, message, safeMeta);
  } else {
    console.log(prefix, message, safeMeta);
  }
}

export const logger = {
  info(context: string, message: string, meta?: unknown): void {
    logMessage("info", context, message, meta);
  },
  warn(context: string, message: string, meta?: unknown): void {
    logMessage("warn", context, message, meta);
  },
  error(context: string, message: string, meta?: unknown): void {
    logMessage("error", context, message, meta);
  },
  debug(context: string, message: string, meta?: unknown): void {
    if (process.env.DEBUG === "true" || process.env.NODE_ENV !== "production") {
      logMessage("debug", context, message, meta);
    }
  },
};
