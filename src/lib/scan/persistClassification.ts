import type { Priority } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import type { ClassificationResult } from "@/lib/schemas/classification";

const EXCERPT_MAX_CHARS = 500;

function toPriorityEnum(p: ClassificationResult["priority"]): Priority {
  return p.toUpperCase() as Priority;
}

function parseDueDate(dueDate: string | null): Date | null {
  if (!dueDate) return null;
  const parsed = new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type PersistClassificationResult = {
  tasksCreated: number;
  tasksUpdated: number;
};

/**
 * Applies one thread's validated classification to the DB. Never touches
 * COMPLETED/DISMISSED tasks — those are permanently closed. Matches a new
 * classification's task against existing OPEN/WAITING_FOR_REPLY tasks on
 * the same thread by case-insensitive exact title; updates on a match,
 * creates a new Task row otherwise, so a re-classified thread can only
 * ever add genuinely new action items.
 */
export async function persistClassification(input: {
  emailThreadId: string;
  classification: ClassificationResult;
}): Promise<PersistClassificationResult> {
  const { emailThreadId, classification } = input;

  const thread = await prisma.emailThread.findUniqueOrThrow({
    where: { id: emailThreadId },
    include: { messages: { orderBy: { sentAt: "asc" } } },
  });
  const latestMessage = thread.messages.at(-1);

  let tasksCreated = 0;
  let tasksUpdated = 0;
  let firstPersistedTaskId: string | null = null;

  if (classification.actionable && latestMessage) {
    const openTasks = await prisma.task.findMany({
      where: { emailThreadId, status: { in: ["OPEN", "WAITING_FOR_REPLY"] } },
    });

    for (const aiTask of classification.tasks) {
      const existing = openTasks.find((t) => t.title.trim().toLowerCase() === aiTask.title.trim().toLowerCase());
      const dueDate = parseDueDate(aiTask.dueDate);
      const dueDateSource = aiTask.dueDateSource ? (aiTask.dueDateSource.toUpperCase() as "EXPLICIT" | "INFERRED") : null;
      const dueDateExplanation = dueDateSource === "INFERRED" ? aiTask.description : null;

      if (existing) {
        await prisma.task.update({
          where: { id: existing.id },
          data: {
            description: aiTask.description,
            emailSummary: classification.summary,
            priority: toPriorityEnum(classification.priority),
            dueDate,
            dueDateSource,
            dueDateExplanation,
            confidence: classification.confidence,
            suggestedOwnerRole: aiTask.suggestedOwnerRole,
          },
        });
        tasksUpdated++;
        firstPersistedTaskId ??= existing.id;
        await writeAuditEvent({
          eventType: "TASK_CLASSIFIED",
          entityType: "Task",
          entityId: existing.id,
          metadata: { emailThreadId, updated: true, priority: classification.priority },
        });
      } else {
        const created = await prisma.task.create({
          data: {
            emailThreadId,
            sourceEmailMessageId: latestMessage.id,
            title: aiTask.title,
            description: aiTask.description,
            emailSummary: classification.summary,
            priority: toPriorityEnum(classification.priority),
            dueDate,
            dueDateSource,
            dueDateExplanation,
            confidence: classification.confidence,
            suggestedOwnerRole: aiTask.suggestedOwnerRole,
            originalExcerpt: latestMessage.sanitizedBodyText.slice(0, EXCERPT_MAX_CHARS),
          },
        });
        tasksCreated++;
        firstPersistedTaskId ??= created.id;
        await writeAuditEvent({
          eventType: "TASK_CLASSIFIED",
          entityType: "Task",
          entityId: created.id,
          metadata: { emailThreadId, updated: false, priority: classification.priority },
        });
      }
    }

    if (classification.needsReply && classification.suggestedReply && firstPersistedTaskId) {
      const existingReply = await prisma.suggestedReply.findUnique({ where: { taskId: firstPersistedTaskId } });
      // Never touch a reply that's already been edited or drafted — the
      // scan pipeline must not clobber human work or drafting state.
      if (!existingReply) {
        await prisma.suggestedReply.create({
          data: {
            taskId: firstPersistedTaskId,
            subject: classification.suggestedReply.subject,
            body: classification.suggestedReply.body,
            aiGeneratedOriginalSubject: classification.suggestedReply.subject,
            aiGeneratedOriginalBody: classification.suggestedReply.body,
          },
        });
      }
    }
  }

  await prisma.emailThread.update({
    where: { id: emailThreadId },
    data: {
      lastClassifiedAt: new Date(),
      lastClassifiedMessageCount: thread.messages.length,
      storedSummary: classification.summary,
    },
  });

  return { tasksCreated, tasksUpdated };
}
