import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { MockGmailProvider } from "@/lib/gmail/mockProvider";
import { syncGmailAccount } from "@/lib/sync/incrementalSync";

const provider = new MockGmailProvider();
const createdAccountIds: string[] = [];

async function createTestAccount(emailAddress: string) {
  const account = await prisma.gmailAccount.create({
    data: { emailAddress, displayName: emailAddress },
  });
  createdAccountIds.push(account.id);
  return account;
}

afterEach(async () => {
  // GmailAccount -> EmailThread -> EmailMessage cascade on delete, so this
  // fully cleans up everything a test created.
  await prisma.gmailAccount.deleteMany({ where: { id: { in: createdAccountIds } } });
  createdAccountIds.length = 0;
});

describe("syncGmailAccount", () => {
  it("first sync backfills the current mailbox state and advances the cursor", async () => {
    const account = await createTestAccount("rutgers.hackhers@gmail.com");
    const result = await syncGmailAccount(account.id, provider);

    // Fixture has 4 messages total across all snapshot layers (2 baseline + 2 later).
    expect(result.messagesSeen).toBe(4);
    expect(result.newMessages).toBe(4);
    expect(result.usedBackfillFallback).toBe(false);

    const updated = await prisma.gmailAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(updated.lastHistoryId).toBe("100020");

    const messageCount = await prisma.emailMessage.count({ where: { gmailAccountId: account.id } });
    expect(messageCount).toBe(4);
  });

  it("re-running sync with an unchanged cursor ingests nothing new (idempotent)", async () => {
    const account = await createTestAccount("rutgers.hackhers@gmail.com");
    await syncGmailAccount(account.id, provider);
    const second = await syncGmailAccount(account.id, provider);

    expect(second.newMessages).toBe(0);
    const messageCount = await prisma.emailMessage.count({ where: { gmailAccountId: account.id } });
    expect(messageCount).toBe(4);
  });

  it("an incremental sync from an earlier cursor only fetches messages after that point", async () => {
    // Simulate an account that was already synced once when the mailbox
    // only had the baseline snapshot's content.
    const account = await createTestAccount("rutgers.hackhers@gmail.com");
    await prisma.gmailAccount.update({ where: { id: account.id }, data: { lastHistoryId: "100000" } });

    const result = await syncGmailAccount(account.id, provider);

    // Only the second snapshot's 2 messages are "new" relative to cursor 100000.
    expect(result.newMessages).toBe(2);
    const updated = await prisma.gmailAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(updated.lastHistoryId).toBe("100020");
  });

  it("falls back to a full backfill when the cursor has expired", async () => {
    const account = await createTestAccount("rutgers.hackhers@gmail.com");
    await prisma.gmailAccount.update({ where: { id: account.id }, data: { lastHistoryId: "no-longer-valid-id" } });

    const result = await syncGmailAccount(account.id, provider);

    expect(result.usedBackfillFallback).toBe(true);
    expect(result.newMessages).toBe(4);
  });

  it("deduplicates by gmailMessageId even if a message reappears across syncs", async () => {
    const account = await createTestAccount("rutgers.hackhers@gmail.com");
    await syncGmailAccount(account.id, provider);
    // Force a re-fetch of everything (simulating overlap) by resetting the cursor.
    await prisma.gmailAccount.update({ where: { id: account.id }, data: { lastHistoryId: null } });
    const second = await syncGmailAccount(account.id, provider);

    expect(second.newMessages).toBe(0);
    const messageCount = await prisma.emailMessage.count({ where: { gmailAccountId: account.id } });
    expect(messageCount).toBe(4);
  });
});
