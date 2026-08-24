import { Prisma, type Priority, type Task } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";

const taskWithRelations = Prisma.validator<Prisma.TaskDefaultArgs>()({
  include: {
    // Never select encrypted*Token/scopes here — this feeds a Client
    // Component prop, and anything included gets serialized to the browser.
    emailThread: { include: { gmailAccount: { select: { id: true, emailAddress: true, displayName: true } } } },
    sourceEmailMessage: true,
    assignedOwner: true,
    suggestedReply: true,
    reminders: { orderBy: { remindAt: "asc" } },
  },
});
export type TaskWithRelations = Prisma.TaskGetPayload<typeof taskWithRelations>;

export const DASHBOARD_SECTIONS = ["needsAttention", "upcoming", "waitingForReply", "completed", "ignored"] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

const HIGH_PRIORITIES: Priority[] = ["HIGH", "URGENT"];

/**
 * Sections are a computed view over TaskStatus + priority + dueDate —
 * never stored directly, so there's no risk of a task's status and its
 * displayed section drifting apart.
 */
export function computeSection(task: Pick<Task, "status" | "priority" | "dueDate">, now: Date = new Date()): DashboardSection {
  if (task.status === "COMPLETED") return "completed";
  if (task.status === "DISMISSED") return "ignored";
  if (task.status === "WAITING_FOR_REPLY") return "waitingForReply";

  const windowMs = getEnv().NEEDS_ATTENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const isUrgentPriority = HIGH_PRIORITIES.includes(task.priority);
  const isDueSoon = task.dueDate !== null && task.dueDate.getTime() <= now.getTime() + windowMs;

  return isUrgentPriority || isDueSoon ? "needsAttention" : "upcoming";
}

/**
 * Fetches every task grouped by dashboard section in one pass, so the
 * dashboard page issues one query instead of five.
 */
export async function getTasksGroupedBySection(now: Date = new Date()): Promise<Record<DashboardSection, TaskWithRelations[]>> {
  const tasks = await prisma.task.findMany({
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    ...taskWithRelations,
  });

  const grouped: Record<DashboardSection, TaskWithRelations[]> = {
    needsAttention: [],
    upcoming: [],
    waitingForReply: [],
    completed: [],
    ignored: [],
  };

  for (const task of tasks) {
    grouped[computeSection(task, now)].push(task);
  }

  return grouped;
}
