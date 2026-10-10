/**
 * Accurate percentile and performance metrics calculation.
 * Handles edge cases like empty sample sets, single samples, and identical values.
 */

export interface LatencyPercentiles {
  p95: number | null;
  p99: number | null;
  avg: number | null;
}

export function calculatePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  // Nearest-rank method with linear interpolation
  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return Math.round((sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight) * 100) / 100;
}

export function computeLatencyMetrics(latencies: number[]): LatencyPercentiles {
  if (latencies.length === 0) {
    return { p95: null, p99: null, avg: null };
  }

  const sorted = [...latencies].sort(function (a, b) {
    return a - b;
  });

  const sum = sorted.reduce(function (acc, val) {
    return acc + val;
  }, 0);
  const avg = Math.round((sum / sorted.length) * 100) / 100;

  const p95 = calculatePercentile(sorted, 95);
  const p99 = calculatePercentile(sorted, 99);

  return { p95, p99, avg };
}

export function computeAvailability(totalChecks: number, successCount: number): number | null {
  if (totalChecks === 0) {
    return null;
  }
  return Math.round((successCount / totalChecks) * 10000) / 100;
}

export function computeErrorRate(totalChecks: number, failureCount: number): number {
  if (totalChecks === 0) {
    return 0;
  }
  return Math.round((failureCount / totalChecks) * 10000) / 100;
}
