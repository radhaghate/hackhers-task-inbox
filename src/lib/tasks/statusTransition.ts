import type { AuditEventType, Task, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";

const AUDIT_EVENT_FOR_STATUS: Record<TaskStatus, AuditEventType> = {
  OPEN: "TASK_RESTORED",
  WAITING_FOR_REPLY: "TASK_STATUS_CHANGED",
  COMPLETED: "TASK_COMPLETED",
  DISMISSED: "TASK_DISMISSED",
};

/**
 * Moves a task to a new status, setting/clearing the matching timestamp
 * fields and writing the audit trail entry — the one place every status
 * transition (complete/dismiss/restore/waiting-for-reply) goes through.
 */
export async function transitionTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  actorTeamMemberId: string | null,
): Promise<Task | null> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return null;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      completedAt: newStatus === "COMPLETED" ? new Date() : null,
      dismissedAt: newStatus === "DISMISSED" ? new Date() : null,
    },
  });

  await writeAuditEvent({
    eventType: AUDIT_EVENT_FOR_STATUS[newStatus],
    entityType: "Task",
    entityId: taskId,
    actorTeamMemberId,
    metadata: { oldStatus: existing.status, newStatus },
  });

  return updated;
}
