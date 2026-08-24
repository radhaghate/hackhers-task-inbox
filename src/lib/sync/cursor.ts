import { prisma } from "@/lib/db/prisma";

/** Reads the persisted Gmail history-id cursor for an account, or null if this account has never been synced. */
export async function getCursor(gmailAccountId: string): Promise<string | null> {
  const account = await prisma.gmailAccount.findUniqueOrThrow({
    where: { id: gmailAccountId },
    select: { lastHistoryId: true },
  });
  return account.lastHistoryId;
}

/** Advances the persisted cursor after a successful sync. */
export async function setCursor(gmailAccountId: string, historyId: string): Promise<void> {
  await prisma.gmailAccount.update({
    where: { id: gmailAccountId },
    data: { lastHistoryId: historyId },
  });
}
