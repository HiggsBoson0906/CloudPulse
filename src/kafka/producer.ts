import { Producer } from "kafkajs";
import crypto from "crypto";
import { getKafka } from "./client";
import { KAFKA_TOPICS } from "./topics";
import { HealthCheckEvent, HealthCheckEventPayload } from "../types/event.types";
import { logger } from "../utils/logger";

let producerInstance: Producer | null = null;
let isConnected = false;

export async function getProducer(): Promise<Producer> {
  if (!producerInstance) {
    const kafka = getKafka();
    producerInstance = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    producerInstance.on("producer.connect", function (): void {
      isConnected = true;
      logger.info("KafkaProducer", "Connected to Kafka broker");
    });

    producerInstance.on("producer.disconnect", function (): void {
      isConnected = false;
      logger.warn("KafkaProducer", "Disconnected from Kafka broker");
    });
  }

  if (!isConnected) {
    await producerInstance.connect();
    isConnected = true;
  }

  return producerInstance;
}

export async function publishHealthCheckEvent(payload: HealthCheckEventPayload): Promise<HealthCheckEvent> {
  const producer = await getProducer();

  const event: HealthCheckEvent = {
    id: crypto.randomUUID(),
    type: "cloudpulse.health-check.v1",
    version: "1.0.0",
    producer: "cloudpulse-monitoring-worker",
    timestamp: new Date().toISOString(),
    payload,
  };

  await producer.send({
    topic: KAFKA_TOPICS.HEALTH_CHECKS,
    messages: [
      {
        key: payload.serviceId, // Partition key ensures ordered processing per service
        value: JSON.stringify(event),
        headers: {
          "event-id": event.id,
          "event-type": event.type,
          "event-version": event.version,
        },
      },
    ],
  });

  return event;
}

export async function closeProducer(): Promise<void> {
  if (producerInstance && isConnected) {
    try {
      await producerInstance.disconnect();
    } catch (err: unknown) {
      logger.warn("KafkaProducer", "Error during producer disconnect", err);
    }
    producerInstance = null;
    isConnected = false;
  }
}
