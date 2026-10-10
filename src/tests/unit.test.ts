import assert from "assert";
import {
  calculatePercentile,
  computeAvailability,
  computeErrorRate,
  computeLatencyMetrics,
} from "../utils/metrics-calculator";
import { isPrivateOrForbiddenIp, validateTargetUrl } from "../utils/ssrf-validator";
import { cacheService } from "../redis/cache.service";
import { isAlertWithinCooldown } from "../services/alert-engine.service";

export async function runUnitTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function runTest(name: string, fn: () => Promise<void> | void): Promise<void> {
    return Promise.resolve()
      .then(fn)
      .then(function () {
        passed++;
        console.log(`  ✓ [PASS] ${name}`);
      })
      .catch(function (err: unknown) {
        failed++;
        console.error(`  ✗ [FAIL] ${name}:`, err instanceof Error ? err.message : err);
      });
  }

  console.log("\n--- RUNNING UNIT TESTS ---");

  // 1. Metrics calculations
  await runTest("Metrics: empty latencies returns null percentiles", function () {
    const res = computeLatencyMetrics([]);
    assert.strictEqual(res.p95, null);
    assert.strictEqual(res.p99, null);
    assert.strictEqual(res.avg, null);
  });

  await runTest("Metrics: single latency sample returns that value for percentiles", function () {
    const res = computeLatencyMetrics([120]);
    assert.strictEqual(res.p95, 120);
    assert.strictEqual(res.p99, 120);
    assert.strictEqual(res.avg, 120);
  });

  await runTest("Metrics: accurate P95 and P99 for distribution", function () {
    // 100 samples from 1 to 100
    const samples = Array.from({ length: 100 }, function (_, i) {
      return i + 1;
    });
    const p95 = calculatePercentile(samples, 95);
    const p99 = calculatePercentile(samples, 99);
    assert(p95 !== null && p95 >= 94 && p95 <= 96, `P95 expected ~95, got ${p95}`);
    assert(p99 !== null && p99 >= 98 && p99 <= 100, `P99 expected ~99, got ${p99}`);
  });

  await runTest("Metrics: availability & error rate edge cases", function () {
    assert.strictEqual(computeAvailability(0, 0), null);
    assert.strictEqual(computeErrorRate(0, 0), 0);
    assert.strictEqual(computeAvailability(100, 95), 95);
    assert.strictEqual(computeErrorRate(100, 5), 5);
  });

  // 2. SSRF Validator
  await runTest("SSRF: blocks cloud metadata IPs", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("169.254.169.254"), true);
    assert.strictEqual(isPrivateOrForbiddenIp("169.254.170.2"), true);
  });

  await runTest("SSRF: blocks loopback addresses", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("127.0.0.1"), true);
    assert.strictEqual(isPrivateOrForbiddenIp("127.0.1.5"), true);
    assert.strictEqual(isPrivateOrForbiddenIp("::1"), true);
    assert.strictEqual(isPrivateOrForbiddenIp("::ffff:127.0.0.1"), true);
  });

  await runTest("SSRF: blocks private RFC1918 ranges when allowPrivate is false", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("10.0.0.1", false), true);
    assert.strictEqual(isPrivateOrForbiddenIp("172.20.0.5", false), true);
    assert.strictEqual(isPrivateOrForbiddenIp("192.168.1.1", false), true);
  });

  await runTest("SSRF: allows private RFC1918 ranges when allowPrivate is true", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("10.0.0.1", true), false);
    assert.strictEqual(isPrivateOrForbiddenIp("192.168.1.1", true), false);
    // Still blocks metadata even when allowPrivate is true!
    assert.strictEqual(isPrivateOrForbiddenIp("169.254.169.254", true), true);
  });

  await runTest("SSRF: rejects non-http protocols and malformed URLs", async function () {
    const ftp = await validateTargetUrl("ftp://example.com/health");
    assert.strictEqual(ftp.isValid, false);

    const file = await validateTargetUrl("file:///etc/passwd");
    assert.strictEqual(file.isValid, false);

    const malformed = await validateTargetUrl("not-a-valid-url");
    assert.strictEqual(malformed.isValid, false);
  });

  // 3. Redis Failure & In-Memory Fallback
  await runTest("Redis resilience: safe fallback handles operations without throwing", async function () {
    // When Redis is unreachable or fallback is active, rate limiting functions without crashing
    const res1 = await cacheService.checkRateLimit("test-client-ip", 2, 60);
    assert.strictEqual(res1.allowed, true);
    assert.strictEqual(res1.remaining, 1);

    const res2 = await cacheService.checkRateLimit("test-client-ip", 2, 60);
    assert.strictEqual(res2.allowed, true);
    assert.strictEqual(res2.remaining, 0);

    const res3 = await cacheService.checkRateLimit("test-client-ip", 2, 60);
    assert.strictEqual(res3.allowed, false);
    assert.strictEqual(res3.remaining, 0);
  });

  // 4. Alert Cooldown Semantics
  await runTest(
    "Alert cooldown: suppresses immediate refire after resolution when active duration exceeded cooldown",
    function () {
      const cooldownMinutes = 5; // 5 min cooldown
      const t0 = 1000000;
      const tActiveDuration = 15 * 60 * 1000; // active for 15 minutes (exceeds 5m cooldown)
      const tResolved = t0 + tActiveDuration;

      const resolvedAlert = {
        triggeredAt: new Date(t0).toISOString(),
        resolvedAt: new Date(tResolved).toISOString(),
      };

      // Fails immediately after recovery (e.g. 10 seconds later)
      const immediateFailureTime = tResolved + 10 * 1000;
      assert.strictEqual(
        isAlertWithinCooldown(resolvedAlert, cooldownMinutes, immediateFailureTime),
        true,
        "Cooldown should suppress alert immediately after resolution"
      );

      // Fails 6 minutes after resolution (exceeds 5 minute cooldown window from resolution)
      const postCooldownFailureTime = tResolved + 6 * 60 * 1000;
      assert.strictEqual(
        isAlertWithinCooldown(resolvedAlert, cooldownMinutes, postCooldownFailureTime),
        false,
        "Cooldown should permit alert once cooldown window elapsed post-resolution"
      );
    }
  );

  await runTest("Alert cooldown: falls back to triggeredAt when alert has not resolved", function () {
    const cooldownMinutes = 5;
    const t0 = 1000000;
    const activeAlert = {
      triggeredAt: new Date(t0).toISOString(),
      resolvedAt: null,
    };

    // 2 minutes after trigger: in cooldown
    assert.strictEqual(isAlertWithinCooldown(activeAlert, cooldownMinutes, t0 + 2 * 60 * 1000), true);
    // 6 minutes after trigger: cooldown expired
    assert.strictEqual(isAlertWithinCooldown(activeAlert, cooldownMinutes, t0 + 6 * 60 * 1000), false);
  });

  return { passed, failed };
}
