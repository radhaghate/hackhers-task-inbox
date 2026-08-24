import { prisma } from "@/lib/db/prisma";
import { sanitizeEmailBody } from "@/lib/sanitize/emailSanitizer";
import { GmailHistoryExpiredError, type GmailAccountRef, type GmailProvider } from "@/lib/gmail/types";
import { dedupeAgainstDb } from "./dedupe";
import { setCursor } from "./cursor";

export type SyncAccountResult = {
  gmailAccountId: string;
  messagesSeen: number;
  newMessages: number;
  threadsTouchedIds: string[];
  usedBackfillFallback: boolean;
};

/**
 * Syncs one GmailAccount: fetches only what's new since the persisted
 * cursor (or a bounded backfill on first sync), dedupes against already-
 * stored messages, upserts EmailThread/EmailMessage, and advances the
 * cursor. Never sends anything to the LLM — that's the scan orchestrator's
 * job, using this function's output to find classification candidates.
 */
export async function syncGmailAccount(gmailAccountId: string, provider: GmailProvider): Promise<SyncAccountResult> {
  const account = await prisma.gmailAccount.findUniqueOrThrow({ where: { id: gmailAccountId } });
  const accountRef: GmailAccountRef = {
    emailAddress: account.emailAddress,
    encryptedAccessToken: account.encryptedAccessToken,
    encryptedRefreshToken: account.encryptedRefreshToken,
    tokenExpiresAt: account.tokenExpiresAt,
  };

  let usedBackfillFallback = false;
  let fetchResult;

  if (account.lastHistoryId === null) {
    fetchResult = await provider.fetchMessagesSince({ account: accountRef, startHistoryId: null });
  } else {
    try {
      fetchResult = await provider.fetchMessagesSince({ account: accountRef, startHistoryId: account.lastHistoryId });
    } catch (error) {
      if (!(error instanceof GmailHistoryExpiredError)) throw error;
      usedBackfillFallback = true;
      fetchResult = await provider.fetchMessagesSince({ account: accountRef, startHistoryId: null });
    }
  }

  const unseen = await dedupeAgainstDb(gmailAccountId, fetchResult.messages);
  unseen.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  const threadsTouched = new Set<string>();
  for (const msg of unseen) {
    const thread = await prisma.emailThread.upsert({
      where: { gmailAccountId_gmailThreadId: { gmailAccountId, gmailThreadId: msg.gmailThreadId } },
      create: {
        gmailAccountId,
        gmailThreadId: msg.gmailThreadId,
        subject: msg.threadSubject,
        lastMessageAt: new Date(msg.sentAt),
        messageCount: 1,
      },
      update: {
        subject: msg.threadSubject,
        lastMessageAt: new Date(msg.sentAt),
        messageCount: { increment: 1 },
      },
    });

    await prisma.emailMessage.upsert({
      where: { gmailAccountId_gmailMessageId: { gmailAccountId, gmailMessageId: msg.gmailMessageId } },
      create: {
        emailThreadId: thread.id,
        gmailAccountId,
        gmailMessageId: msg.gmailMessageId,
        fromAddress: msg.fromAddress,
        toAddresses: msg.toAddresses,
        sentAt: new Date(msg.sentAt),
        snippet: msg.snippet,
        sanitizedBodyText: sanitizeEmailBody(msg.bodyText),
        rawSizeBytes: Buffer.byteLength(msg.bodyText, "utf8"),
        isFromOrgAccount: msg.isFromOrgAccount,
        historyId: msg.historyId,
      },
      // Dedup above already prevents this path in practice; a no-op update
      // is the safe fallback if a race ever lands here.
      update: {},
    });

    threadsTouched.add(thread.id);
  }

  await setCursor(gmailAccountId, fetchResult.historyId);

  return {
    gmailAccountId,
    messagesSeen: fetchResult.messages.length,
    newMessages: unseen.length,
    threadsTouchedIds: [...threadsTouched],
    usedBackfillFallback,
  };
}
