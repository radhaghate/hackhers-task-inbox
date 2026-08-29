import "dotenv/config";
import { applyClassificationBatch } from "@/lib/scan/manualBatch";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/apply-classifications.ts <path-to-classification-batch.json>");
    process.exitCode = 1;
    return;
  }

  const result = await applyClassificationBatch(filePath);

  await writeAuditEvent({
    eventType: "SCAN_COMPLETED",
    entityType: "ScanRun",
    entityId: result.scanRunId,
    metadata: {
      manualBatchApplied: true,
      tasksCreated: result.tasksCreated,
      tasksUpdated: result.tasksUpdated,
      skipped: result.skipped,
      invalid: result.invalid,
    },
  });

  console.log(`Applied manual classification batch: ${filePath}`);
  console.log(`  Tasks created:  ${result.tasksCreated}`);
  console.log(`  Tasks updated:  ${result.tasksUpdated}`);
  console.log(`  Skipped (no result yet): ${result.skipped}`);
  if (result.invalid > 0) {
    console.log(`  Invalid (schema failure, not applied): ${result.invalid} — ${result.invalidThreadIds.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error("Applying classification batch failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
