import "dotenv/config";
import { exportPendingClassificationBatch } from "@/lib/scan/manualBatch";
import { prisma } from "@/lib/db/prisma";

async function main() {
  const filePath = await exportPendingClassificationBatch();
  if (!filePath) {
    console.log("No outstanding candidate threads to export — everything already synced is classified.");
    return;
  }
  console.log(`Exported pending candidate threads to:\n  ${filePath}`);
  console.log(`\nFill in each entry's "result" field, then apply with:\n  npx tsx scripts/apply-classifications.ts ${filePath}`);
}

main()
  .catch((error) => {
    console.error("Exporting classification batch failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
