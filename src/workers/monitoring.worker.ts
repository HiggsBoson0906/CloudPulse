import { config } from "../config";
import { enforceStartupConfig } from "../config/validator";
import * as servicesRepo from "../db/repositories/services.repo";
import { executeServiceCheck, toHealthCheckPayload } from "../services/monitoring.service";
import { publishHealthCheckEvent, closeProducer } from "../kafka/producer";
import { ensureKafkaTopics } from "../kafka/client";
import { cacheService } from "../redis/cache.service";
import { closeRedis } from "../redis/client";
import { closePool } from "../db/pool";
import { logger } from "../utils/logger";

let isRunning = true;
// Track last check timestamp per service to honor checkIntervalSeconds
const lastCheckTimes = new Map<string, number>();

async function checkDueServices(): Promise<void> {
  try {
    const services = await servicesRepo.listServices({ isEnabled: true });
    const now = Date.now();

    const dueServices = services.filter(function (s) {
      const lastCheck = lastCheckTimes.get(s.id) || 0;
      const intervalMs = s.checkIntervalSeconds * 1000;
      return now - lastCheck >= intervalMs;
    });

    if (dueServices.length === 0) return;

    logger.debug("MonitoringWorker", `Executing health checks for ${dueServices.length} due services...`);

    // Process in batches bounded by concurrency config
    const batchSize = config.monitoring.concurrency;
    for (let i = 0; i < dueServices.length; i += batchSize) {
      const batch = dueServices.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async function (service) {
          lastCheckTimes.set(service.id, now);
          const result = await executeServiceCheck(service);
          if (result) {
            const payload = toHealthCheckPayload(result);

            // 1. Publish to Kafka event stream
            try {
              await publishHealthCheckEvent(payload);
            } catch (kafkaErr: unknown) {
              logger.warn("MonitoringWorker", `Failed to publish check event for service ${service.id} to Kafka:`, kafkaErr);
            }

            // 2. Update latest status in Redis
            try {
              await cacheService.setLatestServiceStatus(service.id, {
                serviceId: service.id,
                name: service.name,
                isSuccess: result.isSuccess,
                statusCode: result.statusCode,
                latencyMs: result.latencyMs,
                failureReason: result.failureReason,
                lastCheckedAt: result.checkTimestamp,
              }, 300);
            } catch (redisErr: unknown) {
              logger.warn("MonitoringWorker", `Failed updating Redis status for service ${service.id}:`, redisErr);
            }
          }
        })
      );
    }
  } catch (loopErr: unknown) {
    logger.error("MonitoringWorker", "Error during monitoring cycle:", loopErr);
  }
}

async function startMonitoringWorker(): Promise<void> {
  enforceStartupConfig();
  logger.info("MonitoringWorker", `Starting monitoring worker (interval: ${config.monitoring.loopIntervalMs}ms, concurrency: ${config.monitoring.concurrency})`);

  // Ensure Kafka topics exist
  await ensureKafkaTopics();

  async function scheduleNext(): Promise<void> {
    if (!isRunning) return;
    await checkDueServices();
    if (isRunning) {
      setTimeout(scheduleNext, config.monitoring.loopIntervalMs);
    }
  }

  scheduleNext();
}

async function handleShutdown(signal: string): Promise<void> {
  logger.info("MonitoringWorker", `Received ${signal}. Stopping monitoring worker...`);
  isRunning = false;

  try {
    await closeProducer();
    await closeRedis();
    await closePool();
    logger.info("MonitoringWorker", "Shutdown complete.");
    process.exit(0);
  } catch (err: unknown) {
    logger.error("MonitoringWorker", "Error during worker shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", function (): void {
  handleShutdown("SIGTERM");
});
process.on("SIGINT", function (): void {
  handleShutdown("SIGINT");
});

startMonitoringWorker();
