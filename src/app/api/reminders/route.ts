import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { createReminderSchema } from "@/lib/schemas/task";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const task = await prisma.task.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const actorTeamMemberId = await getCurrentTeamMemberId();
  const reminder = await prisma.reminder.create({
    data: {
      taskId: parsed.data.taskId,
      remindAt: new Date(parsed.data.remindAt),
      note: parsed.data.note ?? null,
      createdByTeamMemberId: actorTeamMemberId,
    },
  });

  await writeAuditEvent({
    eventType: "REMINDER_SCHEDULED",
    entityType: "Reminder",
    entityId: reminder.id,
    actorTeamMemberId,
    metadata: { taskId: parsed.data.taskId, remindAt: parsed.data.remindAt },
  });

  return NextResponse.json({ reminder }, { status: 201 });
}
