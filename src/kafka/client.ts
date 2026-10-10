import { Kafka, logLevel } from "kafkajs";
import { config } from "../config";
import { logger } from "../utils/logger";
import { KAFKA_TOPICS } from "./topics";

let kafkaInstance: Kafka | null = null;

export function getKafka(): Kafka {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 8,
      },
    });
  }
  return kafkaInstance;
}

export async function ensureKafkaTopics(): Promise<void> {
  const kafka = getKafka();
  const admin = kafka.admin();

  try {
    await admin.connect();
    const existingTopics = await admin.listTopics();

    const topicsToCreate = [
      {
        topic: KAFKA_TOPICS.HEALTH_CHECKS,
        numPartitions: 3,
        replicationFactor: 1,
      },
      {
        topic: KAFKA_TOPICS.DEAD_LETTER,
        numPartitions: 1,
        replicationFactor: 1,
      },
    ].filter(function (t) {
      return !existingTopics.includes(t.topic);
    });

    if (topicsToCreate.length > 0) {
      logger.info("Kafka", `Creating topics: ${topicsToCreate.map(function (t) { return t.topic; }).join(", ")}`);
      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
      });
    }
  } catch (err: unknown) {
    logger.warn("Kafka", "Topic verification warning (broker may auto-create or still be starting):", err);
  } finally {
    try {
      await admin.disconnect();
    } catch {
      // Ignore disconnect error
    }
  }
}
