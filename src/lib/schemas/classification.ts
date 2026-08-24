import { z } from "zod";

/**
 * Shape the LLM must return for one email thread's candidate context.
 * Kept exactly to the spec: unknown values are null, never omitted or
 * guessed. Classification (actionable/priority/tasks) and drafting
 * (suggestedReply) are validated together but are logically separate —
 * callers should skip reply generation entirely for non-actionable mail
 * rather than relying on this schema to enforce that (see prompt.ts).
 */
export const aiTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  dueDate: z.string().nullable(),
  dueDateSource: z.enum(["explicit", "inferred"]).nullable(),
  suggestedOwnerRole: z.string().nullable(),
});

export const aiSuggestedReplySchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const classificationResultSchema = z.object({
  actionable: z.boolean(),
  reason: z.string().min(1),
  summary: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tasks: z.array(aiTaskSchema),
  needsReply: z.boolean(),
  suggestedReply: aiSuggestedReplySchema.nullable(),
  confidence: z.number().min(0).max(1),
});

export type AiTask = z.infer<typeof aiTaskSchema>;
export type AiSuggestedReply = z.infer<typeof aiSuggestedReplySchema>;
export type ClassificationResult = z.infer<typeof classificationResultSchema>;

/**
 * Validates a raw (already-JSON-parsed) model response. Returns a
 * discriminated result instead of throwing so the scan orchestrator can
 * skip one bad thread without failing the whole run.
 */
export function parseClassificationResult(
  raw: unknown,
): { success: true; data: ClassificationResult } | { success: false; error: string } {
  const result = classificationResultSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { success: true, data: result.data };
}
