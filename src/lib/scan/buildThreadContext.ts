import { prisma } from "@/lib/db/prisma";
import type { ClassifyThreadInput } from "@/lib/ai/types";

/**
 * Assembles the compact context sent to the model for one candidate
 * thread: the stored rolling summary plus only the messages that arrived
 * since the thread was last classified — never the full thread history.
 */
export async function buildThreadContext(emailThreadId: string): Promise<ClassifyThreadInput> {
  const thread = await prisma.emailThread.findUniqueOrThrow({
    where: { id: emailThreadId },
    include: { gmailAccount: { select: { emailAddress: true } } },
  });
  const messages = await prisma.emailMessage.findMany({
    where: { emailThreadId },
    orderBy: { sentAt: "asc" },
  });
  const newMessages = messages.slice(thread.lastClassifiedMessageCount);

  return {
    accountLabel: thread.gmailAccount.emailAddress,
    subject: thread.subject,
    storedSummary: thread.storedSummary,
    newMessages: newMessages.map((m) => ({
      fromAddress: m.fromAddress,
      sentAt: m.sentAt.toISOString(),
      isFromOrgAccount: m.isFromOrgAccount,
      sanitizedBodyText: m.sanitizedBodyText,
    })),
  };
}
