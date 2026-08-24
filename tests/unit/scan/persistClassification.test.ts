import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { persistClassification } from "@/lib/scan/persistClassification";
import type { ClassificationResult } from "@/lib/schemas/classification";

const createdAccountIds: string[] = [];

afterEach(async () => {
  await prisma.gmailAccount.deleteMany({ where: { id: { in: createdAccountIds } } });
  createdAccountIds.length = 0;
});

async function makeThreadWithMessage(overrides?: { taskTitle?: string; taskStatus?: "COMPLETED" | "DISMISSED" }) {
  const account = await prisma.gmailAccount.create({
    data: { emailAddress: `test-${crypto.randomUUID()}@example.com`, displayName: "Test Account" },
  });
  createdAccountIds.push(account.id);

  const thread = await prisma.emailThread.create({
    data: {
      gmailAccountId: account.id,
      gmailThreadId: "thread-1",
      subject: "W9 for sponsorship payment",
      lastMessageAt: new Date("2026-08-14T00:00:00.000Z"),
      messageCount: 1,
      lastClassifiedMessageCount: 1,
    },
  });

  const firstMessage = await prisma.emailMessage.create({
    data: {
      emailThreadId: thread.id,
      gmailAccountId: account.id,
      gmailMessageId: "msg-1",
      fromAddress: "finance@partnerfirm.example",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: new Date("2026-08-14T00:00:00.000Z"),
      sanitizedBodyText: "Please send us your completed W9 for the sponsorship payment.",
      rawSizeBytes: 100,
      isFromOrgAccount: false,
    },
  });

  const existingTask = await prisma.task.create({
    data: {
      emailThreadId: thread.id,
      sourceEmailMessageId: firstMessage.id,
      title: overrides?.taskTitle ?? "Send W9 to sponsor",
      description: "Send the completed W9 form to the sponsor's finance team.",
      emailSummary: "Sponsor requests a completed W9.",
      priority: "MEDIUM",
      confidence: 0.9,
      originalExcerpt: "Please send us your completed W9.",
      status: overrides?.taskStatus ?? "COMPLETED",
      completedAt: overrides?.taskStatus === "DISMISSED" ? null : new Date("2026-08-15T00:00:00.000Z"),
      dismissedAt: overrides?.taskStatus === "DISMISSED" ? new Date("2026-08-15T00:00:00.000Z") : null,
    },
  });

  return { account, thread, firstMessage, existingTask };
}

async function addNewMessage(threadId: string, accountId: string) {
  await prisma.emailMessage.create({
    data: {
      emailThreadId: threadId,
      gmailAccountId: accountId,
      gmailMessageId: "msg-2",
      fromAddress: "finance@partnerfirm.example",
      toAddresses: ["rutgerswics@gmail.com"],
      sentAt: new Date("2026-08-21T00:00:00.000Z"),
      sanitizedBodyText: "One more small thing — can you also confirm your mailing address for the check?",
      rawSizeBytes: 100,
      isFromOrgAccount: false,
    },
  });
  await prisma.emailThread.update({ where: { id: threadId }, data: { messageCount: { increment: 1 } } });
}

const unrelatedClassification: ClassificationResult = {
  actionable: true,
  reason: "New follow-up question on an otherwise closed thread.",
  summary: "Confirm mailing address for the sponsorship check.",
  priority: "medium",
  tasks: [
    {
      title: "Confirm mailing address",
      description: "Reply with the club's current mailing address for the check.",
      dueDate: null,
      dueDateSource: null,
      suggestedOwnerRole: "Treasurer",
    },
  ],
  needsReply: true,
  suggestedReply: { subject: "Re: W9 for sponsorship payment", body: "Our mailing address is..." },
  confidence: 0.8,
};

describe("persistClassification — closed tasks are never reopened", () => {
  it("does not mutate a COMPLETED task when the same thread is reclassified", async () => {
    const { thread, account, existingTask } = await makeThreadWithMessage({ taskStatus: "COMPLETED" });
    await addNewMessage(thread.id, account.id);

    await persistClassification({ emailThreadId: thread.id, classification: unrelatedClassification });

    const reloaded = await prisma.task.findUniqueOrThrow({ where: { id: existingTask.id } });
    expect(reloaded.status).toBe("COMPLETED");
    expect(reloaded.title).toBe("Send W9 to sponsor");
    expect(reloaded.description).toBe(existingTask.description);
  });

  it("does not mutate a DISMISSED task when the same thread is reclassified", async () => {
    const { thread, account, existingTask } = await makeThreadWithMessage({ taskStatus: "DISMISSED" });
    await addNewMessage(thread.id, account.id);

    await persistClassification({ emailThreadId: thread.id, classification: unrelatedClassification });

    const reloaded = await prisma.task.findUniqueOrThrow({ where: { id: existingTask.id } });
    expect(reloaded.status).toBe("DISMISSED");
  });

  it("creates a separate new task for a genuinely new action item on a thread with a closed task", async () => {
    const { thread, account } = await makeThreadWithMessage({ taskStatus: "COMPLETED" });
    await addNewMessage(thread.id, account.id);

    const result = await persistClassification({ emailThreadId: thread.id, classification: unrelatedClassification });

    expect(result.tasksCreated).toBe(1);
    expect(result.tasksUpdated).toBe(0);
    const allTasks = await prisma.task.findMany({ where: { emailThreadId: thread.id } });
    expect(allTasks).toHaveLength(2);
    const newTask = allTasks.find((t) => t.title === "Confirm mailing address");
    expect(newTask?.status).toBe("OPEN");
  });

  it("updates an existing OPEN task in place when the same title reappears (not a new row)", async () => {
    const { thread, account, existingTask } = await makeThreadWithMessage({
      taskTitle: "Confirm mailing address",
      taskStatus: "COMPLETED",
    });
    // Give this thread an OPEN task with the same title the new classification
    // will produce, to exercise the update-match path instead of create.
    await prisma.task.update({ where: { id: existingTask.id }, data: { status: "OPEN" } });
    await addNewMessage(thread.id, account.id);

    const result = await persistClassification({ emailThreadId: thread.id, classification: unrelatedClassification });

    expect(result.tasksCreated).toBe(0);
    expect(result.tasksUpdated).toBe(1);
    const allTasks = await prisma.task.findMany({ where: { emailThreadId: thread.id } });
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].description).toBe(unrelatedClassification.tasks[0].description);
  });

  it("records the classification summary onto the thread's stored summary and classified-count watermark", async () => {
    const { thread, account } = await makeThreadWithMessage({ taskStatus: "COMPLETED" });
    await addNewMessage(thread.id, account.id);

    await persistClassification({ emailThreadId: thread.id, classification: unrelatedClassification });

    const reloadedThread = await prisma.emailThread.findUniqueOrThrow({ where: { id: thread.id } });
    expect(reloadedThread.storedSummary).toBe(unrelatedClassification.summary);
    expect(reloadedThread.lastClassifiedMessageCount).toBe(2);
    expect(reloadedThread.lastClassifiedAt).not.toBeNull();
  });
});
