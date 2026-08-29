import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { runScan } from "@/lib/scan/orchestrator";
import { applyClassificationBatch, readClassificationBatch } from "@/lib/scan/manualBatch";
import { __resetEnvCacheForTests } from "@/lib/config/env";

const HACKHERS_EMAIL = "rutgers.hackhers@gmail.com";
const WICS_EMAIL = "rutgerswics@gmail.com";

async function seedAccounts() {
  const hackhers = await prisma.gmailAccount.create({ data: { emailAddress: HACKHERS_EMAIL, displayName: "HackHERS" } });
  const wics = await prisma.gmailAccount.create({ data: { emailAddress: WICS_EMAIL, displayName: "WiCS" } });
  return [hackhers, wics];
}

function useManualLLMProvider() {
  process.env.LLM_PROVIDER = "manual";
  __resetEnvCacheForTests();
}

afterEach(async () => {
  process.env.LLM_PROVIDER = "mock";
  __resetEnvCacheForTests();
  // Cascades to threads/messages/tasks/replies.
  await prisma.gmailAccount.deleteMany({ where: { emailAddress: { in: [HACKHERS_EMAIL, WICS_EMAIL] } } });
  await prisma.scanRun.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await fs.rm("data/classification-batches", { recursive: true, force: true });
});

describe("runScan — manual LLM provider mode", () => {
  it("writes a batch file with every candidate thread and creates no tasks or model calls", async () => {
    useManualLLMProvider();
    await seedAccounts();

    const { status, manualBatchFilePath } = await runScan({ mode: "LIVE", trigger: "CLI" });
    expect(status).toBe("SUCCEEDED");
    expect(manualBatchFilePath).toBeTruthy();

    const scanRun = await prisma.scanRun.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(scanRun.modelCallsCount).toBe(0);
    expect(scanRun.threadsClassified).toBe(0);
    expect(await prisma.task.count()).toBe(0);

    const batch = await readClassificationBatch(manualBatchFilePath!);
    expect(batch.scanRunId).toBe(scanRun.id);
    expect(batch.threads.length).toBeGreaterThan(0);
    expect(batch.threads.every((t) => t.result === null)).toBe(true);
    expect(batch.systemPrompt.length).toBeGreaterThan(0);
  });

  it("applyClassificationBatch persists filled-in results via the same rules as the live pipeline", async () => {
    useManualLLMProvider();
    await seedAccounts();

    const { manualBatchFilePath } = await runScan({ mode: "LIVE", trigger: "CLI" });
    const batch = await readClassificationBatch(manualBatchFilePath!);

    const actionableEntry = batch.threads.find((t) => /workshop schedule/i.test(t.subject));
    expect(actionableEntry).toBeDefined();
    actionableEntry!.result = {
      actionable: true,
      reason: "Contains a concrete scheduling request.",
      summary: "Confirm the workshop time slot.",
      priority: "high",
      tasks: [
        {
          title: "Confirm workshop time slot",
          description: "Reply with the confirmed time for the workshop.",
          dueDate: null,
          dueDateSource: null,
          suggestedOwnerRole: null,
        },
      ],
      needsReply: true,
      suggestedReply: { subject: "Re: workshop schedule", body: "Confirming the requested time works for us." },
      confidence: 0.9,
    };

    await fs.writeFile(manualBatchFilePath!, JSON.stringify(batch, null, 2), "utf-8");

    const result = await applyClassificationBatch(manualBatchFilePath!);
    expect(result.tasksCreated).toBe(1);
    expect(result.skipped).toBe(batch.threads.length - 1);
    expect(result.invalid).toBe(0);

    const task = await prisma.task.findFirstOrThrow({ where: { title: "Confirm workshop time slot" } });
    expect(task.priority).toBe("HIGH");
  });

  it("skips entries with an invalid result instead of throwing", async () => {
    useManualLLMProvider();
    await seedAccounts();

    const { manualBatchFilePath } = await runScan({ mode: "LIVE", trigger: "CLI" });
    const batch = await readClassificationBatch(manualBatchFilePath!);
    batch.threads[0].result = { actionable: "not-a-boolean" };
    await fs.writeFile(manualBatchFilePath!, JSON.stringify(batch, null, 2), "utf-8");

    const result = await applyClassificationBatch(manualBatchFilePath!);
    expect(result.invalid).toBe(1);
    expect(result.tasksCreated).toBe(0);
  });
});
