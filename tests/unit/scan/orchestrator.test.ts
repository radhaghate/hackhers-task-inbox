import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { runScan } from "@/lib/scan/orchestrator";

const HACKHERS_EMAIL = "rutgers.hackhers@gmail.com";
const WICS_EMAIL = "rutgerswics@gmail.com";

async function seedAccounts() {
  const hackhers = await prisma.gmailAccount.create({ data: { emailAddress: HACKHERS_EMAIL, displayName: "HackHERS" } });
  const wics = await prisma.gmailAccount.create({ data: { emailAddress: WICS_EMAIL, displayName: "WiCS" } });
  return [hackhers, wics];
}

afterEach(async () => {
  // Cascades to threads/messages/tasks/replies.
  await prisma.gmailAccount.deleteMany({ where: { emailAddress: { in: [HACKHERS_EMAIL, WICS_EMAIL] } } });
  await prisma.scanRun.deleteMany({});
  await prisma.auditEvent.deleteMany({});
});

describe("runScan — dry run", () => {
  it("syncs mail and reports candidate counts but creates no tasks and makes no model calls", async () => {
    await seedAccounts();

    const { status } = await runScan({ mode: "DRY_RUN", trigger: "CLI" });
    expect(status).toBe("SUCCEEDED");

    const scanRun = await prisma.scanRun.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(scanRun.modelCallsCount).toBe(0);
    expect(scanRun.messagesSeen).toBeGreaterThan(0);
    expect(scanRun.threadsClassified).toBe(0);

    const taskCount = await prisma.task.count();
    expect(taskCount).toBe(0);
    // Sync itself still runs in a dry run, so messages should be persisted.
    const messageCount = await prisma.emailMessage.count();
    expect(messageCount).toBeGreaterThan(0);
  });
});

describe("runScan — live run against mock Gmail + mock LLM", () => {
  it("creates tasks only for actionable threads and skips newsletters/receipts", async () => {
    await seedAccounts();

    const { status } = await runScan({ mode: "LIVE", trigger: "CLI" });
    expect(status).toBe("SUCCEEDED");

    const tasks = await prisma.task.findMany({ include: { emailThread: true } });
    const taskSubjects = tasks.map((t) => t.emailThread.subject);

    expect(taskSubjects).toContain("HackHERS 2026 workshop schedule");
    expect(taskSubjects).toContain("Venue AV setup form");
    expect(taskSubjects).toContain("Guest speaker for spring kickoff?");
    expect(taskSubjects).toContain("W9 for sponsorship payment");
    expect(taskSubjects).not.toContain("ACM-W Monthly Digest — August");
    expect(taskSubjects).not.toContain("Your Canva for Nonprofits receipt");

    const scanRun = await prisma.scanRun.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(scanRun.modelCallsCount).toBeGreaterThan(0);
    expect(scanRun.tasksCreated).toBe(tasks.length);
  });

  it("is idempotent: re-running immediately creates no new tasks or model calls", async () => {
    await seedAccounts();
    await runScan({ mode: "LIVE", trigger: "CLI" });
    const taskCountAfterFirst = await prisma.task.count();

    const second = await runScan({ mode: "LIVE", trigger: "CLI" });
    expect(second.status).toBe("SUCCEEDED");

    const secondScanRun = await prisma.scanRun.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(secondScanRun.modelCallsCount).toBe(0);
    expect(secondScanRun.newMessages).toBe(0);

    const taskCountAfterSecond = await prisma.task.count();
    expect(taskCountAfterSecond).toBe(taskCountAfterFirst);
  });

  it("writes an audit trail for scan start and completion", async () => {
    await seedAccounts();
    const { scanRunId } = await runScan({ mode: "LIVE", trigger: "MANUAL_UI" });

    const events = await prisma.auditEvent.findMany({ where: { entityType: "ScanRun", entityId: scanRunId } });
    expect(events.some((e) => e.eventType === "SCAN_STARTED")).toBe(true);
    expect(events.some((e) => e.eventType === "SCAN_COMPLETED")).toBe(true);
  });
});
