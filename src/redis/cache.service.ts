import { getRedisClient, isRedisHealthy, safeRedisDel, safeRedisGet, safeRedisSet } from "./client";
import { logger } from "../utils/logger";

const KEY_PREFIX_STATUS = "cloudpulse:service:status:";
const KEY_DASHBOARD_SUMMARY = "cloudpulse:dashboard:summary";
const KEY_PREFIX_RATE_LIMIT = "cloudpulse:ratelimit:";

// In-memory fallback for rate limiting when Redis is down
const inMemoryRateLimit = new Map<string, { count: number; expiresAt: number }>();

export const cacheService = {
  async getLatestServiceStatus<T>(serviceId: string): Promise<T | null> {
    const json = await safeRedisGet(`${KEY_PREFIX_STATUS}${serviceId}`);
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  async setLatestServiceStatus(serviceId: string, status: unknown, ttlSeconds = 300): Promise<void> {
    const json = JSON.stringify(status);
    await safeRedisSet(`${KEY_PREFIX_STATUS}${serviceId}`, json, ttlSeconds);
  },

  async getDashboardSummary<T>(): Promise<T | null> {
    const json = await safeRedisGet(KEY_DASHBOARD_SUMMARY);
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  },

  async setDashboardSummary(summary: unknown, ttlSeconds = 30): Promise<void> {
    const json = JSON.stringify(summary);
    await safeRedisSet(KEY_DASHBOARD_SUMMARY, json, ttlSeconds);
  },

  async invalidateServiceCache(serviceId: string): Promise<void> {
    await safeRedisDel(`${KEY_PREFIX_STATUS}${serviceId}`);
    await safeRedisDel(KEY_DASHBOARD_SUMMARY);
  },

  async checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    if (isRedisHealthy()) {
      try {
        const client = getRedisClient();
        const key = `${KEY_PREFIX_RATE_LIMIT}${identifier}`;
        const current = await client.incr(key);

        if (current === 1) {
          await client.expire(key, windowSeconds);
        }

        const remaining = Math.max(0, limit - current);
        return {
          allowed: current <= limit,
          remaining,
        };
      } catch (err: unknown) {
        logger.warn("CacheService", "Redis rate limiting failed, falling back to in-memory", err);
      }
    }

    // Fallback in-memory rate limiting
    const now = Date.now();
    const entry = inMemoryRateLimit.get(identifier);

    if (!entry || entry.expiresAt <= now) {
      inMemoryRateLimit.set(identifier, {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    entry.count++;
    const remaining = Math.max(0, limit - entry.count);
    return {
      allowed: entry.count <= limit,
      remaining,
    };
  },
};
