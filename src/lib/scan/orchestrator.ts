import type { ScanMode, ScanRunStatus, ScanTriggerSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getGmailProvider } from "@/lib/gmail/providerFactory";
import { getLLMProvider } from "@/lib/ai/providerFactory";
import { syncGmailAccount } from "@/lib/sync/incrementalSync";
import { computeCandidateThreadIds } from "@/lib/sync/materialChange";
import { buildThreadContext } from "./buildThreadContext";
import { persistClassification } from "./persistClassification";
import { runWithConcurrency } from "./batching";
import { addUsage, estimateCostUsd, newUsageAccumulator } from "./usageLogger";
import { parseClassificationResult } from "@/lib/schemas/classification";

export type RunScanInput = {
  mode: ScanMode;
  trigger: ScanTriggerSource;
};

export type RunScanResult = {
  scanRunId: string;
  status: ScanRunStatus;
};

/**
 * The full scan pipeline: sync -> material-change detection -> (dry-run
 * stops here) -> classify candidates with bounded concurrency -> validate
 * -> persist -> usage logging. One ScanRun row and an audit trail entry
 * bookend every run, success or failure.
 */
export async function runScan(input: RunScanInput): Promise<RunScanResult> {
  const scanRun = await prisma.scanRun.create({
    data: { trigger: input.trigger, mode: input.mode, status: "RUNNING", gmailAccountsScanned: [] },
  });
  await writeAuditEvent({
    eventType: "SCAN_STARTED",
    entityType: "ScanRun",
    entityId: scanRun.id,
    metadata: { trigger: input.trigger, mode: input.mode },
  });

  try {
    const gmailProvider = getGmailProvider();
    const accounts = await prisma.gmailAccount.findMany({ where: { isActive: true } });

    let messagesSeen = 0;
    let newMessages = 0;
    let fallbackUsedAny = false;
    const threadsSeenIds = new Set<string>();

    for (const account of accounts) {
      const syncResult = await syncGmailAccount(account.id, gmailProvider);
      messagesSeen += syncResult.messagesSeen;
      newMessages += syncResult.newMessages;
      fallbackUsedAny ||= syncResult.usedBackfillFallback;
      syncResult.threadsTouchedIds.forEach((id) => threadsSeenIds.add(id));
    }

    const touchedThreads = await prisma.emailThread.findMany({
      where: { id: { in: [...threadsSeenIds] } },
      select: { id: true, gmailAccountId: true, messageCount: true, lastClassifiedMessageCount: true },
    });
    const candidateIds = computeCandidateThreadIds(
      touchedThreads.map((t) => ({
        emailThreadId: t.id,
        messageCount: t.messageCount,
        lastClassifiedMessageCount: t.lastClassifiedMessageCount,
      })),
    );

    if (input.mode === "DRY_RUN") {
      await prisma.scanRun.update({
        where: { id: scanRun.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          gmailAccountsScanned: accounts.map((a) => a.emailAddress),
          threadsSeen: threadsSeenIds.size,
          messagesSeen,
          newMessages,
          threadsClassified: 0,
          modelCallsCount: 0,
        },
      });
      await writeAuditEvent({
        eventType: "SCAN_COMPLETED",
        entityType: "ScanRun",
        entityId: scanRun.id,
        metadata: { dryRun: true, candidateThreadCount: candidateIds.length, fallbackUsed: fallbackUsedAny },
      });
      return { scanRunId: scanRun.id, status: "SUCCEEDED" };
    }

    const llmProvider = getLLMProvider();
    const usage = newUsageAccumulator();
    let tasksCreated = 0;
    let tasksUpdated = 0;
    let invalidResponseCount = 0;

    await runWithConcurrency(candidateIds, getEnv().MAX_CONCURRENT_CLASSIFY_CALLS, async (emailThreadId) => {
      const context = await buildThreadContext(emailThreadId);

      let output;
      try {
        output = await llmProvider.classify(context);
      } catch {
        invalidResponseCount++;
        return;
      }

      const validated = parseClassificationResult(output.result);
      if (!validated.success) {
        invalidResponseCount++;
        return;
      }

      addUsage(usage, output.usage);
      const persisted = await persistClassification({ emailThreadId, classification: validated.data });
      tasksCreated += persisted.tasksCreated;
      tasksUpdated += persisted.tasksUpdated;
    });

    const status: ScanRunStatus = invalidResponseCount > 0 ? "PARTIAL" : "SUCCEEDED";
    const env = getEnv();
    await prisma.scanRun.update({
      where: { id: scanRun.id },
      data: {
        status,
        finishedAt: new Date(),
        gmailAccountsScanned: accounts.map((a) => a.emailAddress),
        threadsSeen: threadsSeenIds.size,
        messagesSeen,
        newMessages,
        threadsClassified: candidateIds.length,
        tasksCreated,
        tasksUpdated,
        modelCallsCount: usage.modelCallsCount,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        estimatedCostUsd: estimateCostUsd(env.ANTHROPIC_MODEL, usage.promptTokens, usage.completionTokens),
      },
    });

    if (accounts.length > 0) {
      await prisma.gmailAccount.updateMany({
        where: { id: { in: accounts.map((a) => a.id) } },
        data: { lastSuccessfulScanAt: new Date() },
      });
    }

    await writeAuditEvent({
      eventType: "SCAN_COMPLETED",
      entityType: "ScanRun",
      entityId: scanRun.id,
      metadata: { tasksCreated, tasksUpdated, modelCalls: usage.modelCallsCount, invalidResponseCount, fallbackUsed: fallbackUsedAny },
    });

    return { scanRunId: scanRun.id, status };
  } catch (error) {
    await prisma.scanRun.update({
      where: { id: scanRun.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: (error as Error).message },
    });
    await writeAuditEvent({
      eventType: "SCAN_FAILED",
      entityType: "ScanRun",
      entityId: scanRun.id,
      metadata: { error: (error as Error).message },
    });
    throw error;
  }
}
