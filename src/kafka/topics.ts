import { config } from "../config";

export const KAFKA_TOPICS = {
  HEALTH_CHECKS: config.kafka.healthTopic,
  DEAD_LETTER: config.kafka.dlqTopic,
} as const;

export const KAFKA_GROUPS = {
  EVENT_PROCESSOR: config.kafka.groupId,
} as const;
