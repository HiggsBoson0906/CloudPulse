import { runUnitTests } from "./unit.test";
import { runIntegrationTests } from "./integration.test";
import { logger } from "../utils/logger";
import { closePool } from "../db/pool";

async function main(): Promise<void> {
  console.log("=========================================");
  console.log("CloudPulse Phase 3 Test Suite");
  console.log("=========================================");

  const unitResults = await runUnitTests();
  const integrationResults = await runIntegrationTests();

  const totalPassed = unitResults.passed + integrationResults.passed;
  const totalFailed = unitResults.failed + integrationResults.failed;

  console.log("\n--- TEST SUMMARY ---");
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log("=========================================");

  try {
    await closePool();
  } catch {
    // Ignore pool closure errors on exit
  }

  if (totalFailed > 0) {
    logger.error("TestRunner", `${totalFailed} test(s) failed.`);
    process.exit(1);
  } else {
    logger.info("TestRunner", `All ${totalPassed} tests passed successfully!`);
    process.exit(0);
  }
}

main().catch(function (err: unknown): void {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
