import assert from "assert";
import { query } from "../db/pool";
import { config } from "../config";
import { isAlertWithinCooldown } from "../services/alert-engine.service";
import { validateTargetUrl } from "../utils/ssrf-validator";
import { createSafeDispatcher } from "../utils/ssrf-dispatcher";

export async function runIntegrationTests(): Promise<{ passed: number; failed: number }> {
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

  console.log("\n--- RUNNING INTEGRATION & RESILIENCE TESTS ---");

  // 1. Pipeline Verification: Database & Recent Health Checks
  await runTest("Pipeline: Database contains healthy records from mock-service", async function () {
    const res = await query(
      "SELECT s.name, h.status_code, h.is_success, h.latency_ms FROM health_check_results h JOIN services s ON s.id = h.service_id WHERE h.check_timestamp > NOW() - INTERVAL '5 minutes' ORDER BY h.check_timestamp DESC LIMIT 1;"
    );
    assert(res.rows.length > 0, "Expected at least 1 recent health check result");
    const check = res.rows[0];
    assert.strictEqual(check.status_code, 200);
    assert.strictEqual(check.is_success, true);
    assert(check.latency_ms >= 0, "Latency must be a non-negative number");
  });

  // 2. Incident Lifecycle
  await runTest("Incident Lifecycle: OPEN -> ACKNOWLEDGED -> RESOLVED transitions", async function () {
    const incRes = await query(
      "INSERT INTO incidents (service_id, title, severity, status, summary) VALUES ((SELECT id FROM services LIMIT 1), 'Lifecycle Integration Test', 'medium', 'OPEN', 'Testing incident lifecycle transitions') RETURNING id, status;"
    );
    const incidentId = incRes.rows[0].id;
    assert.strictEqual(incRes.rows[0].status, "OPEN");

    // Transition to ACKNOWLEDGED
    const ackRes = await query(
      "UPDATE incidents SET status = 'ACKNOWLEDGED', acknowledged_at = NOW() WHERE id = $1 RETURNING status;",
      [incidentId]
    );
    assert.strictEqual(ackRes.rows[0].status, "ACKNOWLEDGED");

    // Transition to RESOLVED
    const resRes = await query(
      "UPDATE incidents SET status = 'RESOLVED', resolved_at = NOW() WHERE id = $1 RETURNING status;",
      [incidentId]
    );
    assert.strictEqual(resRes.rows[0].status, "RESOLVED");

    // Cleanup
    await query("DELETE FROM incidents WHERE id = $1;", [incidentId]);
  });

  // 3. Alert Deduplication & Cooldown Resilience
  await runTest("Alert Resilience: Cooldown suppresses immediate refire post-recovery", function () {
    const t0 = Date.now();
    const resolvedAlert = {
      triggeredAt: new Date(t0 - 10 * 60 * 1000).toISOString(),
      resolvedAt: new Date(t0 - 2 * 60 * 1000).toISOString(), // resolved 2 min ago
    };
    // 5 min cooldown -> must be within cooldown
    assert.strictEqual(isAlertWithinCooldown(resolvedAlert, 5, t0), true);
    // 1 min cooldown -> expired
    assert.strictEqual(isAlertWithinCooldown(resolvedAlert, 1, t0), false);
  });

  // 4. SSRF Defense: Strict Private Whitelist Enforcement
  await runTest("SSRF Security: Unapproved private target is rejected by validator", async function () {
    const check = await validateTargetUrl("http://unapproved-internal-service:8080/health", {
      allowPrivate: false,
      allowedPrivateHosts: ["mock-service"],
    });
    // If unresolvable or resolving to internal, it must not be validly approved
    if (check.isValid) {
      assert.fail("Unapproved private target must not be marked valid");
    }
  });

  // 5. SSRF Defense: Loopback and Cloud Metadata Strictly Blocked in Dispatcher
  await runTest("SSRF Dispatcher: Socket-level connect block against 127.0.0.1", async function () {
    const dispatcher = createSafeDispatcher("http://loopback-target.internal", {
      pinnedIp: "127.0.0.1",
      allowPrivate: false,
      allowedPrivateHosts: ["mock-service"],
    });

    let threw = false;
    try {
      await fetch("http://loopback-target.internal", { dispatcher } as any);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, "Socket connection to loopback must throw");
  });

  return { passed, failed };
}
