import { validateTargetUrl } from "../utils/ssrf-validator";
import { ServiceRecord } from "../types/service.types";
import { HealthCheckEventPayload } from "../types/event.types";
import { config } from "../config";
import { logger } from "../utils/logger";

// Concurrency protection: Set of service IDs currently undergoing a health check
const inFlightChecks = new Set<string>();

export interface CheckExecutionResult {
  serviceId: string;
  checkTimestamp: string;
  statusCode: number | null;
  latencyMs: number;
  isSuccess: boolean;
  failureReason: string | null;
  environment: string;
}

/**
 * Safely extracts human-readable failure reasons from probe errors, including nested causes
 * (such as undici / native fetch TLS errors like UNABLE_TO_GET_ISSUER_CERT_LOCALLY and ECONNREFUSED)
 * without logging sensitive headers, payloads, or credentials.
 */
export function extractProbeFailureReason(err: unknown, timeoutMs: number): string {
  if (!err) return "Network error";

  if (err instanceof Error) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return `Request timed out after ${timeoutMs}ms`;
    }

    const causeDetails: string[] = [];
    let current: unknown = err;
    let depth = 0;

    // Traverse up to 3 levels of nested causes (standard in undici / native fetch)
    while (current && depth < 3) {
      if (typeof current === "object" && current !== null) {
        const curObj = current as { message?: unknown; code?: unknown; cause?: unknown };
        if (depth > 0) {
          const msg = typeof curObj.message === "string" ? curObj.message.trim() : "";
          const code = typeof curObj.code === "string" ? curObj.code.trim() : "";

          let part = "";
          if (msg && code && !msg.includes(code)) {
            part = `${msg} (${code})`;
          } else if (msg) {
            part = msg;
          } else if (code) {
            part = code;
          }

          if (part && !causeDetails.includes(part)) {
            causeDetails.push(part);
          }
        }
        current = curObj.cause;
        depth++;
      } else {
        break;
      }
    }

    const baseMessage = err.message.trim() || "Network error";
    if (causeDetails.length > 0) {
      return `${baseMessage}: ${causeDetails.join(" -> ")}`.slice(0, 255);
    }
    return baseMessage.slice(0, 255);
  }

  if (typeof err === "string") {
    return err.slice(0, 255);
  }

  return "Network error";
}

export async function executeServiceCheck(service: ServiceRecord): Promise<CheckExecutionResult | null> {
  // Prevent overlapping checks for the same service
  if (inFlightChecks.has(service.id)) {
    logger.debug("MonitoringService", `Skipping check for service ${service.name} (${service.id}) - check already in-flight`);
    return null;
  }

  inFlightChecks.add(service.id);
  const startTime = Date.now();
  const checkTimestamp = new Date().toISOString();

  try {
    const rawTargetUrl = `${service.baseUrl.replace(/\/+$/, "")}/${service.healthCheckPath.replace(/^\/+/, "")}`;
    const ssrfOptions = {
      allowPrivate: config.monitoring.allowPrivateTargets,
      allowedPrivateHosts: config.monitoring.allowedPrivateHosts,
    };

    // 1. SSRF Validation
    const ssrfCheck = await validateTargetUrl(rawTargetUrl, ssrfOptions);
    if (!ssrfCheck.isValid) {
      const latencyMs = Date.now() - startTime;
      return {
        serviceId: service.id,
        checkTimestamp,
        statusCode: null,
        latencyMs,
        isSuccess: false,
        failureReason: `Blocked by SSRF protection: ${ssrfCheck.reason}`,
        environment: service.environment,
      };
    }

    // 2. Perform HTTP request with bounded redirects and SSRF re-validation
    const maxRetries = 1;
    let attempt = 0;
    let finalStatusCode: number | null = null;
    let isSuccess = false;
    let failureReason: string | null = null;

    while (attempt <= maxRetries && !isSuccess) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(function () {
        controller.abort();
      }, service.timeoutMs);

      try {
        let currentUrl = rawTargetUrl;
        let redirectCount = 0;
        const maxRedirects = 3;

        while (redirectCount <= maxRedirects) {
          // Re-validate current URL for SSRF (applies to initial URL and every redirect hop)
          const ssrfCheck = await validateTargetUrl(currentUrl, ssrfOptions);
          if (!ssrfCheck.isValid) {
            finalStatusCode = null;
            isSuccess = false;
            failureReason = `Blocked by SSRF protection: ${ssrfCheck.reason}`;
            break;
          }

          const response = await fetch(currentUrl, {
            method: "GET",
            signal: controller.signal,
            headers: {
              "User-Agent": "CloudPulse-Monitor/1.0",
              Accept: "*/*",
            },
            redirect: "manual",
          });

          finalStatusCode = response.status;

          // Follow redirect if 3xx status
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            if (!location) {
              isSuccess = false;
              failureReason = `HTTP redirect ${response.status} missing Location header`;
              break;
            }

            try {
              currentUrl = new URL(location, currentUrl).toString();
              redirectCount++;
              continue; // Re-validate target URL in next loop iteration
            } catch {
              isSuccess = false;
              failureReason = `Invalid redirect Location: ${location}`;
              break;
            }
          }

          if (response.status >= 200 && response.status < 400) {
            isSuccess = true;
            failureReason = null;
          } else {
            isSuccess = false;
            failureReason = `HTTP status ${response.status} ${response.statusText}`;
          }
          break;
        }

        if (redirectCount > maxRedirects) {
          isSuccess = false;
          failureReason = `Exceeded maximum redirect limit of ${maxRedirects}`;
        }
      } catch (err: unknown) {
        finalStatusCode = null;
        failureReason = extractProbeFailureReason(err, service.timeoutMs);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      serviceId: service.id,
      checkTimestamp,
      statusCode: finalStatusCode,
      latencyMs,
      isSuccess,
      failureReason,
      environment: service.environment,
    };
  } catch (unexpectedErr: unknown) {
    // Top-level catch ensures a bad service check never crashes the worker
    const latencyMs = Date.now() - startTime;
    logger.error("MonitoringService", `Unexpected error during check for service ${service.id}:`, unexpectedErr);
    return {
      serviceId: service.id,
      checkTimestamp,
      statusCode: null,
      latencyMs,
      isSuccess: false,
      failureReason: extractProbeFailureReason(unexpectedErr, service.timeoutMs),
      environment: service.environment,
    };
  } finally {
    inFlightChecks.delete(service.id);
  }
}

export function toHealthCheckPayload(result: CheckExecutionResult): HealthCheckEventPayload {
  return {
    serviceId: result.serviceId,
    checkTimestamp: result.checkTimestamp,
    statusCode: result.statusCode,
    latencyMs: result.latencyMs,
    isSuccess: result.isSuccess,
    failureReason: result.failureReason,
    environment: result.environment,
  };
}
