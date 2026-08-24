import { z } from "zod";

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assignedOwnerId: z.string().nullable().optional(),
  privateNotes: z.string().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateReplySchema = z.object({
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});
export type UpdateReplyInput = z.infer<typeof updateReplySchema>;

export const createReminderSchema = z.object({
  taskId: z.string().min(1),
  remindAt: z.string().datetime(),
  note: z.string().nullable().optional(),
});
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const updateReminderSchema = z.object({
  status: z.enum(["PENDING", "NOTIFIED", "DISMISSED"]).optional(),
  remindAt: z.string().datetime().optional(),
  note: z.string().nullable().optional(),
});
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
