import { runUnitTests } from "./unit.test";
import { logger } from "../utils/logger";

async function main(): Promise<void> {
  console.log("=========================================");
  console.log("CloudPulse Phase 1 Automated Test Suite");
  console.log("=========================================");

  const unitResults = await runUnitTests();

  console.log("\n--- TEST SUMMARY ---");
  console.log(`Passed: ${unitResults.passed}`);
  console.log(`Failed: ${unitResults.failed}`);
  console.log("=========================================");

  if (unitResults.failed > 0) {
    logger.error("TestRunner", `${unitResults.failed} test(s) failed.`);
    process.exit(1);
  } else {
    logger.info("TestRunner", "All unit tests passed successfully!");
    process.exit(0);
  }
}

main().catch(function (err: unknown): void {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
