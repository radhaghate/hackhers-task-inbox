import { describe, expect, it } from "vitest";
import { parseClassificationResult } from "@/lib/schemas/classification";

const validActionable = {
  actionable: true,
  reason: "The sponsor requested confirmation of the workshop time.",
  summary: "Confirm the workshop schedule with the sponsor.",
  priority: "high",
  tasks: [
    {
      title: "Confirm workshop time",
      description: "Reply with confirmation for the proposed 2 PM slot.",
      dueDate: "2026-09-02",
      dueDateSource: "explicit",
      suggestedOwnerRole: "Sponsorship Lead",
    },
  ],
  needsReply: true,
  suggestedReply: { subject: "Re: HackHERS workshop schedule", body: "Confirming 2 PM works for us." },
  confidence: 0.92,
};

const validNonActionable = {
  actionable: false,
  reason: "This is a monthly newsletter digest with no request of the org.",
  summary: "ACM-W monthly newsletter.",
  priority: "low",
  tasks: [],
  needsReply: false,
  suggestedReply: null,
  confidence: 0.97,
};

describe("classificationResultSchema", () => {
  it("accepts a valid actionable result", () => {
    const result = parseClassificationResult(validActionable);
    expect(result.success).toBe(true);
  });

  it("accepts a valid non-actionable result with empty tasks and null reply", () => {
    const result = parseClassificationResult(validNonActionable);
    expect(result.success).toBe(true);
  });

  it("rejects a result with an invalid priority value", () => {
    const result = parseClassificationResult({ ...validActionable, priority: "critical" });
    expect(result.success).toBe(false);
  });

  it("rejects a result missing required fields", () => {
    const { summary, ...rest } = validActionable;
    void summary;
    const result = parseClassificationResult(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a confidence value out of [0,1] range", () => {
    const result = parseClassificationResult({ ...validActionable, confidence: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a task with an invalid dueDateSource", () => {
    const result = parseClassificationResult({
      ...validActionable,
      tasks: [{ ...validActionable.tasks[0], dueDateSource: "guessed" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null dueDate/dueDateSource/suggestedOwnerRole on a task", () => {
    const result = parseClassificationResult({
      ...validActionable,
      tasks: [
        {
          title: "Follow up",
          description: "General follow-up with no known deadline.",
          dueDate: null,
          dueDateSource: null,
          suggestedOwnerRole: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});
