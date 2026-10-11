import * as checksRepo from "../db/repositories/checks.repo";
import * as metricsRepo from "../db/repositories/metrics.repo";
import { evaluateAlertRulesForCheck } from "../services/alert-engine.service";
import { startEventConsumer, stopEventConsumer } from "../kafka/consumer";
import { ensureKafkaTopics } from "../kafka/client";
import { cacheService } from "../redis/cache.service";
import { closeProducer } from "../kafka/producer";
import { closeRedis } from "../redis/client";
import { closePool } from "../db/pool";
import { HealthCheckEvent } from "../types/event.types";
import { enforceStartupConfig } from "../config/validator";
import { logger } from "../utils/logger";

async function processHealthCheckEvent(event: HealthCheckEvent): Promise<void> {
  const { payload } = event;
  logger.debug("EventProcessor", `Processing health check event for service ${payload.serviceId} (status: ${payload.statusCode}, latency: ${payload.latencyMs}ms)`);

  // 1. Durable storage in PostgreSQL
  try {
    await checksRepo.recordHealthCheck({
      serviceId: payload.serviceId,
      checkTimestamp: payload.checkTimestamp,
      statusCode: payload.statusCode,
      latencyMs: payload.latencyMs,
      isSuccess: payload.isSuccess,
      failureReason: payload.failureReason,
    });
  } catch (err: unknown) {
    // If service was deleted while event was in-flight, discard gracefully
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23503") {
      logger.info("EventProcessor", `Service ${payload.serviceId} was deleted while event was in-flight. Discarding.`);
      return;
    }
    throw err;
  }

  // 2. Compute rollups (15m window) and store aggregate
  try {
    const liveMetrics = await metricsRepo.computeLiveMetrics(payload.serviceId, 15);
    await metricsRepo.upsertMetricAggregate(liveMetrics);
  } catch (metricsErr: unknown) {
    logger.warn("EventProcessor", `Failed updating metric aggregates for service ${payload.serviceId}:`, metricsErr);
  }

  // 3. Evaluate alert rules & group into incidents
  try {
    await evaluateAlertRulesForCheck(payload);
  } catch (alertErr: unknown) {
    logger.error("EventProcessor", `Failed evaluating alert rules for service ${payload.serviceId}:`, alertErr);
  }

  // 4. Invalidate cached dashboard metrics so next request sees latest data
  await cacheService.invalidateServiceCache(payload.serviceId);
}

async function startProcessor(): Promise<void> {
  enforceStartupConfig();
  logger.info("EventProcessor", "Starting Kafka event processor worker...");

  // Ensure Kafka topics are ready before consumer connects
  await ensureKafkaTopics();

  await startEventConsumer(processHealthCheckEvent);
  logger.info("EventProcessor", "Kafka consumer subscribed and actively processing events.");
}

async function handleShutdown(signal: string): Promise<void> {
  logger.info("EventProcessor", `Received ${signal}. Shutting down event processor...`);

  try {
    await stopEventConsumer();
    await closeProducer();
    await closeRedis();
    await closePool();
    logger.info("EventProcessor", "Shutdown complete.");
    process.exit(0);
  } catch (err: unknown) {
    logger.error("EventProcessor", "Error during event processor shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", function (): void {
  handleShutdown("SIGTERM");
});
process.on("SIGINT", function (): void {
  handleShutdown("SIGINT");
});

startProcessor().catch(function (err: unknown): void {
  logger.error("EventProcessor", "Fatal startup error in event processor worker:", err);
  process.exit(1);
});
