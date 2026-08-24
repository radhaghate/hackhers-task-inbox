import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { updateTaskSchema } from "@/lib/schemas/task";

export async function GET(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { emailThread: { include: { gmailAccount: true } }, assignedOwner: true, suggestedReply: true, reminders: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const { dueDate, ...rest } = parsed.data;
  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null, dueDateSource: "EXPLICIT" } : {}),
    },
  });

  const actorTeamMemberId = await getCurrentTeamMemberId();
  await writeAuditEvent({
    eventType: "TASK_FIELD_EDITED",
    entityType: "Task",
    entityId: taskId,
    actorTeamMemberId,
    metadata: { editedFields: Object.keys(parsed.data) },
  });

  return NextResponse.json({ task: updated });
}
