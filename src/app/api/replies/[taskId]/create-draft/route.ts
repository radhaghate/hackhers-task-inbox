import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { getGmailProvider } from "@/lib/gmail/providerFactory";

/**
 * The ONLY route in the app that creates a Gmail draft. Requires an
 * explicit, synchronous POST from a signed-in team member (the UI gates
 * this behind a confirmation modal) — nothing in the scan pipeline can
 * reach this code path, and the GmailProvider interface has no send
 * method at all, so nothing is ever dispatched automatically.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      suggestedReply: true,
      emailThread: { include: { gmailAccount: true, messages: { orderBy: { sentAt: "asc" } } } },
    },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!task.suggestedReply) return NextResponse.json({ error: "This task has no suggested reply" }, { status: 400 });
  if (task.suggestedReply.gmailDraftId) {
    return NextResponse.json({ error: "A draft has already been created for this reply" }, { status: 409 });
  }

  const actorTeamMemberId = await getCurrentTeamMemberId();
  const lastExternalMessage = [...task.emailThread.messages].reverse().find((m) => !m.isFromOrgAccount);
  const recipient = lastExternalMessage?.fromAddress ?? task.emailThread.messages.at(-1)?.fromAddress;
  if (!recipient) {
    return NextResponse.json({ error: "Could not determine a recipient for this thread" }, { status: 400 });
  }

  try {
    const provider = getGmailProvider();
    const account = task.emailThread.gmailAccount;
    const { draftId } = await provider.createDraft({
      account: {
        emailAddress: account.emailAddress,
        encryptedAccessToken: account.encryptedAccessToken,
        encryptedRefreshToken: account.encryptedRefreshToken,
        tokenExpiresAt: account.tokenExpiresAt,
      },
      gmailThreadId: task.emailThread.gmailThreadId,
      to: [recipient],
      subject: task.suggestedReply.subject,
      body: task.suggestedReply.body,
    });

    const updated = await prisma.suggestedReply.update({
      where: { taskId },
      data: { gmailDraftId: draftId, draftCreatedAt: new Date(), draftApprovedByTeamMemberId: actorTeamMemberId },
    });

    await writeAuditEvent({
      eventType: "DRAFT_CREATED",
      entityType: "SuggestedReply",
      entityId: task.suggestedReply.id,
      actorTeamMemberId,
      metadata: { taskId, draftId },
    });

    return NextResponse.json({ reply: updated });
  } catch (error) {
    await writeAuditEvent({
      eventType: "DRAFT_CREATION_FAILED",
      entityType: "SuggestedReply",
      entityId: task.suggestedReply.id,
      actorTeamMemberId,
      metadata: { taskId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Failed to create Gmail draft" }, { status: 502 });
  }
}
