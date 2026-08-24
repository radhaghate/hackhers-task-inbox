import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { updateReminderSchema } from "@/lib/schemas/task";

export async function PATCH(request: Request, { params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params;
  const body = await request.json();
  const parsed = updateReminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

  const { remindAt, ...rest } = parsed.data;
  const updated = await prisma.reminder.update({
    where: { id: reminderId },
    data: { ...rest, ...(remindAt ? { remindAt: new Date(remindAt) } : {}) },
  });

  if (parsed.data.status === "DISMISSED") {
    const actorTeamMemberId = await getCurrentTeamMemberId();
    await writeAuditEvent({
      eventType: "REMINDER_DISMISSED",
      entityType: "Reminder",
      entityId: reminderId,
      actorTeamMemberId,
    });
  }

  return NextResponse.json({ reminder: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ reminderId: string }> }) {
  const { reminderId } = await params;
  const existing = await prisma.reminder.findUnique({ where: { id: reminderId } });
  if (!existing) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

  await prisma.reminder.delete({ where: { id: reminderId } });
  return NextResponse.json({ ok: true });
}
