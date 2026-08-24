import type { ClassificationResult } from "@/lib/schemas/classification";
import type { ClassifyThreadInput, ClassifyThreadOutput, LLMProvider } from "./types";

const NON_ACTIONABLE_PATTERN = /newsletter|digest|automated receipt|no action needed|unsubscribe|monthly digest/i;
const URGENT_PATTERN = /\b(asap|urgent|by tomorrow|today)\b/i;
const HIGH_PRIORITY_PATTERN = /\b(deadline|by friday|before (the|our|this)|finalize)\b/i;
const EXPLICIT_DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const NEEDS_REPLY_PATTERN = /\?|please (confirm|let us know|reply|respond)|can you/i;

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function firstSentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const match = /^(.{10,160}?[.!?])(\s|$)/.exec(trimmed);
  return (match ? match[1] : trimmed.slice(0, 160)).trim();
}

/**
 * Deterministic, keyword-driven classifier used whenever LLM_PROVIDER=mock
 * (the default). Not meant to be smart — meant to be predictable, so the
 * dashboard, scan pipeline, and tests all work with zero API key while
 * still exercising the actionable/non-actionable and priority/due-date
 * branches realistically.
 */
export class MockLLMProvider implements LLMProvider {
  async classify(input: ClassifyThreadInput): Promise<ClassifyThreadOutput> {
    const latest = input.newMessages.at(-1);
    const combinedText = input.newMessages.map((m) => m.sanitizedBodyText).join("\n");
    const promptText = `${input.subject}\n${combinedText}`;

    const isActionable = latest !== undefined && !NON_ACTIONABLE_PATTERN.test(promptText);

    let result: ClassificationResult;

    if (!isActionable) {
      result = {
        actionable: false,
        reason: "Matches a non-actionable pattern (newsletter/receipt/automated notification) with no explicit request of the club.",
        summary: latest ? firstSentence(latest.sanitizedBodyText) : "No new content.",
        priority: "low",
        tasks: [],
        needsReply: false,
        suggestedReply: null,
        confidence: 0.95,
      };
    } else {
      const priority = URGENT_PATTERN.test(promptText) ? "urgent" : HIGH_PRIORITY_PATTERN.test(promptText) ? "high" : "medium";
      const needsReply = NEEDS_REPLY_PATTERN.test(promptText);
      // This keyword-driven mock never fabricates a concrete date (matching
      // the "never invent dates" rule) — it can only flag that urgency
      // language implies a near-term deadline, without stating one.
      const impliesDeadline = priority !== "medium" || EXPLICIT_DATE_PATTERN.test(promptText);

      result = {
        actionable: true,
        reason: "The message asks the club to respond, confirm, or complete a task.",
        summary: firstSentence(latest!.sanitizedBodyText),
        priority,
        tasks: [
          {
            title: `Respond to: ${input.subject}`.slice(0, 120),
            description: firstSentence(latest!.sanitizedBodyText),
            dueDate: null,
            dueDateSource: impliesDeadline ? "inferred" : null,
            suggestedOwnerRole: null,
          },
        ],
        needsReply,
        suggestedReply: needsReply
          ? {
              subject: `Re: ${input.subject}`,
              body: `Hi,\n\nThanks for reaching out — we'll follow up with the details shortly.\n\nBest,\n${input.accountLabel}`,
            }
          : null,
        confidence: 0.75,
      };
    }

    return {
      result,
      usage: { promptTokens: estimateTokens(promptText), completionTokens: estimateTokens(JSON.stringify(result)) },
    };
  }
}
