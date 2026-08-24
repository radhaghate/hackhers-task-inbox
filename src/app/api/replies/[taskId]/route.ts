import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { updateReplySchema } from "@/lib/schemas/task";

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await request.json();
  const parsed = updateReplySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.suggestedReply.findUnique({ where: { taskId } });
  if (!existing) return NextResponse.json({ error: "No suggested reply for this task" }, { status: 404 });

  const actorTeamMemberId = await getCurrentTeamMemberId();
  const updated = await prisma.suggestedReply.update({
    where: { taskId },
    data: { ...parsed.data, isEdited: true, editedByTeamMemberId: actorTeamMemberId },
  });

  await writeAuditEvent({
    eventType: "REPLY_EDITED",
    entityType: "SuggestedReply",
    entityId: existing.id,
    actorTeamMemberId,
    metadata: { taskId, editedFields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ reply: updated });
}
