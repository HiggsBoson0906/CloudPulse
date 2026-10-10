import Redis from "ioredis";
import { config } from "../config";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Don't hold operations indefinitely when offline
      lazyConnect: false,
      retryStrategy(times: number): number | null {
        // Exponential backoff capped at 2 seconds
        if (times > 10) {
          logger.warn("Redis", `Retried ${times} times. Slowing down reconnect attempts.`);
          return 5000;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on("connect", function (): void {
      isRedisAvailable = true;
      logger.info("Redis", "Connected to Redis successfully");
    });

    redisClient.on("ready", function (): void {
      isRedisAvailable = true;
    });

    redisClient.on("error", function (err: Error): void {
      isRedisAvailable = false;
      logger.warn("Redis", `Redis error / unavailable: ${err.message}. Proceeding with fallback.`);
    });

    redisClient.on("close", function (): void {
      isRedisAvailable = false;
    });
  }

  return redisClient;
}

export function isRedisHealthy(): boolean {
  if (!redisClient) {
    getRedisClient();
  }
  return isRedisAvailable;
}

export async function safeRedisGet(key: string): Promise<string | null> {
  if (!isRedisAvailable) return null;
  try {
    const client = getRedisClient();
    return await client.get(key);
  } catch (err: unknown) {
    logger.warn("Redis", `safeRedisGet failed for key ${key}`, err);
    return null;
  }
}

export async function safeRedisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isRedisAvailable) return false;
  try {
    const client = getRedisClient();
    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, value, "EX", ttlSeconds);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err: unknown) {
    logger.warn("Redis", `safeRedisSet failed for key ${key}`, err);
    return false;
  }
}

export async function safeRedisDel(key: string): Promise<boolean> {
  if (!isRedisAvailable) return false;
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (err: unknown) {
    logger.warn("Redis", `safeRedisDel failed for key ${key}`, err);
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    isRedisAvailable = false;
  }
}
