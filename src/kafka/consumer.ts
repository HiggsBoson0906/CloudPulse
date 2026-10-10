import { Consumer, EachMessagePayload } from "kafkajs";
import { getKafka } from "./client";
import { getProducer } from "./producer";
import { KAFKA_GROUPS, KAFKA_TOPICS } from "./topics";
import { DeadLetterEvent, HealthCheckEvent } from "../types/event.types";
import { logger } from "../utils/logger";

export type HealthCheckEventHandler = (event: HealthCheckEvent) => Promise<void>;

let consumerInstance: Consumer | null = null;
let isRunning = false;

const MAX_RETRIES = 3;

async function sendToDeadLetterQueue(
  eventStr: string,
  eventId: string,
  reason: string,
  attempts: number
): Promise<void> {
  try {
    const producer = await getProducer();
    const dlqPayload: DeadLetterEvent = {
      originalEventId: eventId,
      originalTopic: KAFKA_TOPICS.HEALTH_CHECKS,
      errorReason: reason,
      failedAt: new Date().toISOString(),
      retryAttempts: attempts,
      rawPayload: eventStr,
    };

    await producer.send({
      topic: KAFKA_TOPICS.DEAD_LETTER,
      messages: [
        {
          key: eventId,
          value: JSON.stringify(dlqPayload),
          headers: {
            "dlq-reason": reason,
            "original-event-id": eventId,
          },
        },
      ],
    });

    logger.warn("KafkaConsumer", `Event ${eventId} routed to Dead Letter Queue (${KAFKA_TOPICS.DEAD_LETTER})`);
  } catch (dlqErr: unknown) {
    logger.error("KafkaConsumer", "Failed to forward event to Dead Letter Queue!", dlqErr);
    throw dlqErr;
  }
}

export async function startEventConsumer(handler: HealthCheckEventHandler): Promise<void> {
  const kafka = getKafka();

  consumerInstance = kafka.consumer({
    groupId: KAFKA_GROUPS.EVENT_PROCESSOR,
    retry: { retries: 5 },
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  await consumerInstance.connect();
  logger.info("KafkaConsumer", `Connected consumer with group '${KAFKA_GROUPS.EVENT_PROCESSOR}'`);

  await consumerInstance.subscribe({
    topic: KAFKA_TOPICS.HEALTH_CHECKS,
    fromBeginning: false,
  });

  isRunning = true;

  await consumerInstance.run({
    autoCommit: true,
    eachMessage: async function (payload: EachMessagePayload): Promise<void> {
      const { message, topic, partition } = payload;
      const rawValue = message.value ? message.value.toString() : "";

      if (!rawValue) {
        logger.warn("KafkaConsumer", "Received empty message in topic", { topic, partition });
        return;
      }

      let event: HealthCheckEvent;
      try {
        event = JSON.parse(rawValue) as HealthCheckEvent;
      } catch (parseErr: unknown) {
        logger.error("KafkaConsumer", "Unparseable JSON in Kafka message. Sending directly to DLQ.", parseErr);
        await sendToDeadLetterQueue(rawValue, "unknown-corrupt-payload", "JSON parse error", 0);
        return;
      }

      let attempt = 0;
      let succeeded = false;
      let lastError: unknown = null;

      while (attempt < MAX_RETRIES && !succeeded) {
        attempt++;
        try {
          await handler(event);
          succeeded = true;
        } catch (err: unknown) {
          lastError = err;
          logger.warn(
            "KafkaConsumer",
            `Processing attempt ${attempt}/${MAX_RETRIES} failed for event ${event.id}:`,
            err instanceof Error ? err.message : err
          );

          if (attempt < MAX_RETRIES) {
            // Exponential backoff between consumer retries
            await new Promise(function (resolve) {
              setTimeout(resolve, 500 * Math.pow(2, attempt - 1));
            });
          }
        }
      }

      if (!succeeded) {
        const errorReason = lastError instanceof Error ? lastError.message : "Processing failed repeatedly";
        await sendToDeadLetterQueue(rawValue, event.id, errorReason, attempt);
      }
    },
  });
}

export async function stopEventConsumer(): Promise<void> {
  if (consumerInstance && isRunning) {
    try {
      await consumerInstance.disconnect();
      logger.info("KafkaConsumer", "Consumer disconnected gracefully");
    } catch (err: unknown) {
      logger.warn("KafkaConsumer", "Error during consumer disconnect", err);
    }
    consumerInstance = null;
    isRunning = false;
  }
}
