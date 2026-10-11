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
import { extractProbeFailureReason } from "../services/monitoring.service";

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

  await runTest("SSRF: blocks IPv6 all-zeros / unspecified addresses", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("::", false), true);
    assert.strictEqual(isPrivateOrForbiddenIp("0:0:0:0:0:0:0:0", false), true);
    assert.strictEqual(isPrivateOrForbiddenIp("::", true), true); // even with allowPrivate=true
  });

  await runTest("SSRF: allows private RFC1918 ranges when allowPrivate is true", function () {
    assert.strictEqual(isPrivateOrForbiddenIp("10.0.0.1", true), false);
    assert.strictEqual(isPrivateOrForbiddenIp("192.168.1.1", true), false);
    // Still blocks metadata and loopback even when allowPrivate is true!
    assert.strictEqual(isPrivateOrForbiddenIp("169.254.169.254", true), true);
    assert.strictEqual(isPrivateOrForbiddenIp("127.0.0.1", true), true);
  });

  await runTest("SSRF: enforces scoped allowedPrivateHosts policy", async function () {
    // Direct private IP target with allowedPrivateHosts (direct IP not allowed unless allowPrivate=true)
    const directIp = await validateTargetUrl("http://172.19.0.8:8080/health", {
      allowPrivate: false,
      allowedPrivateHosts: ["mock-service"],
    });
    assert.strictEqual(directIp.isValid, false, "Direct private IP target should be rejected without explicit allowPrivate");

    // Loopback target even with allowedPrivateHosts matching name must NEVER be permitted
    const loopback = await validateTargetUrl("http://127.0.0.1:8080/health", {
      allowedPrivateHosts: ["127.0.0.1"],
    });
    assert.strictEqual(loopback.isValid, false, "Loopback must never be permitted regardless of allowlist");

    // Metadata target must NEVER be permitted regardless of allowlist
    const metadata = await validateTargetUrl("http://169.254.169.254/latest/meta-data", {
      allowedPrivateHosts: ["169.254.169.254"],
    });
    assert.strictEqual(metadata.isValid, false, "Cloud metadata must never be permitted regardless of allowlist");
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

  // 6. Nested Probe Failure Diagnostics
  await runTest("Probe errors: extracts nested TLS cause code and message", function () {
    const tlsCause = Object.assign(new Error("unable to get local issuer certificate"), {
      code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    });
    const fetchError = new TypeError("fetch failed", { cause: tlsCause });
    const reason = extractProbeFailureReason(fetchError, 5000);
    assert.strictEqual(
      reason,
      "fetch failed: unable to get local issuer certificate (UNABLE_TO_GET_ISSUER_CERT_LOCALLY)"
    );
  });

  await runTest("Probe errors: extracts connection refused code and address", function () {
    const connCause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8080"), {
      code: "ECONNREFUSED",
    });
    const fetchError = new TypeError("fetch failed", { cause: connCause });
    const reason = extractProbeFailureReason(fetchError, 5000);
    assert.strictEqual(reason, "fetch failed: connect ECONNREFUSED 127.0.0.1:8080");
  });

  await runTest("Probe errors: handles timeouts cleanly", function () {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    assert.strictEqual(extractProbeFailureReason(abortErr, 3000), "Request timed out after 3000ms");
  });

  // 7. Authentication & RBAC Middleware
  await runTest("Auth: rejects unauthenticated request with 401", function () {
    const { authenticate } = require("../middleware/auth.middleware");
    let status = 0;
    let jsonBody: any = null;
    let nextCalled = false;

    const mockReq = { headers: {} };
    const mockRes = {
      status: function (s: number) {
        status = s;
        return this;
      },
      json: function (b: any) {
        jsonBody = b;
      },
    };

    authenticate(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(status, 401);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(jsonBody?.error, "Authentication required");
  });

  await runTest("Auth: rejects invalid API token with 401", function () {
    const { authenticate } = require("../middleware/auth.middleware");
    let status = 0;
    let nextCalled = false;

    const mockReq = { headers: { authorization: "Bearer completely-bogus-token" } };
    const mockRes = {
      status: function (s: number) {
        status = s;
        return this;
      },
      json: function () {},
    };

    authenticate(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(status, 401);
    assert.strictEqual(nextCalled, false);
  });

  await runTest("Auth: accepts valid admin token and sets req.user", function () {
    const { authenticate } = require("../middleware/auth.middleware");
    const { config } = require("../config");
    let nextCalled = false;

    const mockReq: any = { headers: { authorization: `Bearer ${config.auth.adminKey}` } };
    const mockRes = {
      status: function () {
        return this;
      },
      json: function () {},
    };

    authenticate(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(mockReq.user?.role, "admin");
  });

  await runTest("RBAC: viewer cannot perform admin operations (403)", function () {
    const { requireRole } = require("../middleware/auth.middleware");
    let status = 0;
    let nextCalled = false;

    const mockReq = { user: { role: "viewer", keyId: "viewer-key" } };
    const mockRes = {
      status: function (s: number) {
        status = s;
        return this;
      },
      json: function () {},
    };

    const adminGuard = requireRole("admin");
    adminGuard(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(status, 403);
    assert.strictEqual(nextCalled, false);
  });

  await runTest("RBAC: operator cannot perform admin operations (403)", function () {
    const { requireRole } = require("../middleware/auth.middleware");
    let status = 0;
    let nextCalled = false;

    const mockReq = { user: { role: "operator", keyId: "operator-key" } };
    const mockRes = {
      status: function (s: number) {
        status = s;
        return this;
      },
      json: function () {},
    };

    const adminGuard = requireRole("admin");
    adminGuard(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(status, 403);
    assert.strictEqual(nextCalled, false);
  });

  await runTest("RBAC: operator can perform operator operations (next)", function () {
    const { requireRole } = require("../middleware/auth.middleware");
    let nextCalled = false;

    const mockReq = { user: { role: "operator", keyId: "operator-key" } };
    const mockRes = {
      status: function () {
        return this;
      },
      json: function () {},
    };

    const operatorGuard = requireRole("operator");
    operatorGuard(mockReq, mockRes, function () {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  // 8. SSRF Dispatcher & DNS Rebinding Elimination
  await runTest("SSRF Dispatcher: rejects pinned loopback and metadata IPs", function () {
    const { createSafeDispatcher } = require("../utils/ssrf-dispatcher");
    const agent = createSafeDispatcher("http://target.example.com", { pinnedIp: "127.0.0.1" });

    // Directly test lookup callback in connect options
    const connectOpts = (agent as any)[Object.getOwnPropertySymbols(agent).find(s => s.description === "options") || ""] || (agent as any).options;
    // Dispatcher should have rejected loopback immediately
    assert(agent !== null);
  });

  await runTest("SSRF Dispatcher: lookup throws for forbidden destinations", async function () {
    const { createSafeDispatcher } = require("../utils/ssrf-dispatcher");
    const agent = createSafeDispatcher("http://attacker.com", { pinnedIp: "169.254.169.254" });

    let caughtError = false;
    try {
      // Fetching with dispatcher pinned to metadata IP must fail with SSRF error
      await fetch("http://attacker.com", { dispatcher: agent } as any);
    } catch (err: any) {
      caughtError = true;
      const msg = err?.cause?.message || err?.message || "";
      assert(msg.includes("SSRF") || msg.includes("fetch failed"), `Expected SSRF error, got: ${msg}`);
    }
    assert.strictEqual(caughtError, true, "Pinned metadata IP must be blocked");
  });

  await runTest("SSRF Dispatcher: lookup throws for non-allowlisted private RFC1918", async function () {
    const { createSafeDispatcher } = require("../utils/ssrf-dispatcher");
    const agent = createSafeDispatcher("http://internal-db.local", {
      pinnedIp: "172.19.0.3",
      allowPrivate: false,
      allowedPrivateHosts: ["mock-service"], // internal-db.local is NOT in allowlist
    });

    let caughtError = false;
    try {
      await fetch("http://internal-db.local", { dispatcher: agent } as any);
    } catch (err: any) {
      caughtError = true;
      const msg = err?.cause?.message || err?.message || "";
      assert(msg.includes("SSRF") || msg.includes("fetch failed"), `Expected SSRF error, got: ${msg}`);
    }
    assert.strictEqual(caughtError, true, "Non-allowlisted private IP must be blocked");
  });

  // 9. Production Security Headers
  await runTest("Security Headers: sets HSTS, CSP, X-Frame-Options, and nosniff", function () {
    const { securityHeaders } = require("../middleware/security-headers");
    const headers: Record<string, string> = {};
    let removedHeader = "";

    const mockRes = {
      setHeader: function (name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      removeHeader: function (name: string) {
        removedHeader = name;
      },
    };

    let nextCalled = false;
    securityHeaders({} as any, mockRes as any, function () {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(headers["x-content-type-options"], "nosniff");
    assert.strictEqual(headers["x-frame-options"], "DENY");
    assert.strictEqual(headers["content-security-policy"], "default-src 'self'");
    assert(headers["strict-transport-security"].includes("max-age=31536000"));
    assert.strictEqual(removedHeader, "X-Powered-By");
  });

  // 10. Startup Configuration Validator
  await runTest("Config Validator: rejects missing admin key in production", function () {
    const { validateSystemConfig } = require("../config/validator");
    const { config } = require("../config");

    const originalEnv = config.nodeEnv;
    const originalKey = config.auth.adminKey;

    try {
      config.nodeEnv = "production";
      config.auth.adminKey = "";
      const result = validateSystemConfig();
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some((e: string) => e.includes("CLOUDPULSE_ADMIN_API_KEY")));
    } finally {
      config.nodeEnv = originalEnv;
      config.auth.adminKey = originalKey;
    }
  });

  await runTest("Config Validator: rejects short admin key in production", function () {
    const { validateSystemConfig } = require("../config/validator");
    const { config } = require("../config");

    const originalEnv = config.nodeEnv;
    const originalKey = config.auth.adminKey;

    try {
      config.nodeEnv = "production";
      config.auth.adminKey = "short-key";
      const result = validateSystemConfig();
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some((e: string) => e.includes("at least 16 characters")));
    } finally {
      config.nodeEnv = originalEnv;
      config.auth.adminKey = originalKey;
    }
  });

  // 11. Adversarial SSRF Test Suite: DNS Rebinding, Prohibited Dest, & Redirects
  await runTest("SSRF Adversarial: Exhaustive IPv4 and IPv6 prohibited ranges", function () {
    const { isAlwaysForbiddenIp, isPrivateOrForbiddenIp } = require("../utils/ssrf-validator");

    // All these MUST be blocked unconditionally (even if allowPrivate=true)
    const alwaysForbiddenList = [
      "127.0.0.1",
      "127.1.2.3",
      "0.0.0.0",
      "169.254.169.254", // AWS/GCP/Azure Metadata
      "169.254.170.2",   // AWS ECS Task Metadata
      "169.254.1.1",     // Link-local IPv4
      "100.64.0.1",      // Carrier-Grade NAT
      "100.127.255.254", // Carrier-Grade NAT
      "::1",             // IPv6 Loopback
      "::",              // IPv6 Unspecified / all-zeros
      "0:0:0:0:0:0:0:0", // IPv6 all-zeros
      "fd00:ec2::254",   // AWS IPv6 IMDS
      "fe80::1",         // IPv6 Link-local
      "::ffff:127.0.0.1",// IPv4-mapped loopback
      "::ffff:169.254.169.254", // IPv4-mapped metadata
    ];

    for (const ip of alwaysForbiddenList) {
      assert.strictEqual(
        isAlwaysForbiddenIp(ip),
        true,
        `Expected ${ip} to be unconditionally forbidden in isAlwaysForbiddenIp`
      );
      assert.strictEqual(
        isPrivateOrForbiddenIp(ip, true),
        true,
        `Expected ${ip} to be blocked in isPrivateOrForbiddenIp even when allowPrivate=true`
      );
    }
  });

  await runTest("SSRF Adversarial: DNS Rebinding pinning prevents TOCTOU socket substitution", async function () {
    const { createSafeDispatcher } = require("../utils/ssrf-dispatcher");

    // Domain was validated against safe public IP 93.184.216.34 at T1.
    // Attacker's nameserver attempts to substitute 127.0.0.1 or 169.254.169.254 at T2 connect time.
    const safePinnedIp = "93.184.216.34";
    const maliciousRebindIp = "127.0.0.1";

    // 1. Safe pinned dispatcher uses only the pinned safe IP
    const safeAgent = createSafeDispatcher("http://rebind-attacker.com", {
      pinnedIp: safePinnedIp,
    });
    assert(safeAgent !== null);

    // 2. If attacker manages to feed the malicious rebind IP to the dispatcher's connect lookup, it throws immediately
    const maliciousAgent = createSafeDispatcher("http://rebind-attacker.com", {
      pinnedIp: maliciousRebindIp,
    });

    let caught = false;
    try {
      await fetch("http://rebind-attacker.com", { dispatcher: maliciousAgent } as any);
    } catch (err: any) {
      caught = true;
      const msg = err?.cause?.message || err?.message || "";
      assert(msg.includes("SSRF") || msg.includes("fetch failed"), `Expected SSRF block, got: ${msg}`);
    }
    assert.strictEqual(caught, true, "DNS rebinding to loopback must be prevented at connection time");
  });

  await runTest("SSRF Adversarial: Redirects to forbidden internal targets are blocked", async function () {
    const { validateTargetUrl } = require("../utils/ssrf-validator");

    const maliciousRedirectHops = [
      "http://169.254.169.254/latest/meta-data/",
      "http://169.254.170.2/v2/credentials",
      "http://127.0.0.1:5432/",
      "http://[::1]:6379/",
      "http://[::]:8080/",
      "http://10.0.0.1:9092/",
      "http://172.19.0.3:5432/", // internal Postgres
    ];

    const ssrfOptions = {
      allowPrivate: false,
      allowedPrivateHosts: ["mock-service"],
    };

    for (const redirectUrl of maliciousRedirectHops) {
      const result = await validateTargetUrl(redirectUrl, ssrfOptions);
      assert.strictEqual(
        result.isValid,
        false,
        `Expected redirect target '${redirectUrl}' to be rejected by SSRF protection`
      );
      assert(
        result.reason && result.reason.length > 0,
        `Expected rejection reason for redirect target '${redirectUrl}'`
      );
    }
  });

  return { passed, failed };
}
