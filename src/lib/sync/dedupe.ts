import { prisma } from "@/lib/db/prisma";
import type { GmailMessageRecord } from "@/lib/gmail/types";

/**
 * Filters out messages we've already stored, keyed by the same
 * [gmailAccountId, gmailMessageId] uniqueness the DB enforces. Pure
 * function over an id set so it's cheaply unit-testable; the DB lookup
 * lives in dedupeAgainstDb below.
 */
export function filterUnseenMessages(candidates: GmailMessageRecord[], existingMessageIds: Set<string>): GmailMessageRecord[] {
  return candidates.filter((m) => !existingMessageIds.has(m.gmailMessageId));
}

export async function dedupeAgainstDb(gmailAccountId: string, candidates: GmailMessageRecord[]): Promise<GmailMessageRecord[]> {
  if (candidates.length === 0) return [];
  const existing = await prisma.emailMessage.findMany({
    where: { gmailAccountId, gmailMessageId: { in: candidates.map((c) => c.gmailMessageId) } },
    select: { gmailMessageId: true },
  });
  return filterUnseenMessages(candidates, new Set(existing.map((e) => e.gmailMessageId)));
}
