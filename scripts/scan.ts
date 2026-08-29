import "dotenv/config";
import { runScan } from "@/lib/scan/orchestrator";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log(`Starting ${isDryRun ? "DRY RUN" : "LIVE"} scan (trigger: CLI)...`);
  const { scanRunId, status, manualBatchFilePath } = await runScan({ mode: isDryRun ? "DRY_RUN" : "LIVE", trigger: "CLI" });

  const scanRun = await prisma.scanRun.findUniqueOrThrow({ where: { id: scanRunId } });
  console.log(`\nScan ${status}`);
  console.log(`  Accounts scanned:   ${scanRun.gmailAccountsScanned.join(", ") || "(none)"}`);
  console.log(`  Threads seen:       ${scanRun.threadsSeen}`);
  console.log(`  Messages seen:      ${scanRun.messagesSeen}`);
  console.log(`  New messages:       ${scanRun.newMessages}`);
  console.log(`  Threads classified: ${scanRun.threadsClassified}`);
  console.log(`  Tasks created:      ${scanRun.tasksCreated}`);
  console.log(`  Tasks updated:      ${scanRun.tasksUpdated}`);
  console.log(`  Model calls:        ${scanRun.modelCallsCount}`);
  console.log(`  Prompt tokens:      ${scanRun.promptTokens}`);
  console.log(`  Completion tokens:  ${scanRun.completionTokens}`);
  if (scanRun.estimatedCostUsd !== null) {
    console.log(`  Estimated cost:     $${scanRun.estimatedCostUsd.toFixed(4)}`);
  }
  if (scanRun.errorMessage) {
    console.log(`  Error:              ${scanRun.errorMessage}`);
  }
  if (manualBatchFilePath) {
    console.log(`\nLLM_PROVIDER=manual — no model was called. Classify this batch by hand (e.g. via a Claude Code`);
    console.log(`session, using your existing Claude subscription instead of a paid API key), then apply it:`);
    console.log(`  1. Open ${manualBatchFilePath} and fill in each thread's "result" field.`);
    console.log(`  2. npx tsx scripts/apply-classifications.ts ${manualBatchFilePath}`);
  }
}

main()
  .catch((error) => {
    console.error("Scan failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
