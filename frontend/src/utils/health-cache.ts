import { api } from '../api/client';
import type { HealthCheckResult, ServiceRecord } from '../types';

interface CacheEntry {
  check: HealthCheckResult | null;
  fetchedAt: number;
}

const checkCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20_000; // 20 seconds TTL

/**
 * Fetch the latest health check for multiple services using bounded concurrency
 * to avoid hammering the backend API.
 */
export async function fetchLatestChecksBounded(
  services: ServiceRecord[],
  concurrency = 3
): Promise<Record<string, HealthCheckResult | null>> {
  const now = Date.now();
  const results: Record<string, HealthCheckResult | null> = {};
  const toFetch: ServiceRecord[] = [];

  for (const s of services) {
    const cached = checkCache.get(s.id);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      results[s.id] = cached.check;
    } else {
      toFetch.push(s);
    }
  }

  if (toFetch.length === 0) {
    return results;
  }

  // Bounded worker pool
  let index = 0;
  async function worker(): Promise<void> {
    while (index < toFetch.length) {
      const current = toFetch[index++];
      if (!current) break;

      try {
        const checks = await api.getServiceChecks(current.id, 1);
        const latest = checks.length > 0 ? checks[0] : null;
        checkCache.set(current.id, { check: latest, fetchedAt: Date.now() });
        results[current.id] = latest;
      } catch {
        // Graceful failure per service: keep null, don't crash whole fetch
        checkCache.set(current.id, { check: null, fetchedAt: Date.now() });
        results[current.id] = null;
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, toFetch.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
