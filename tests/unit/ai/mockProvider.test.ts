import { describe, expect, it } from "vitest";
import { MockLLMProvider } from "@/lib/ai/mockProvider";
import { classificationResultSchema } from "@/lib/schemas/classification";

const provider = new MockLLMProvider();

describe("MockLLMProvider", () => {
  it("classifies a newsletter as non-actionable", async () => {
    const { result } = await provider.classify({
      accountLabel: "rutgers.hackhers@gmail.com",
      subject: "ACM-W Monthly Digest — August",
      storedSummary: null,
      newMessages: [
        {
          fromAddress: "digest@acm-w.example",
          sentAt: "2026-08-19T09:00:00.000Z",
          isFromOrgAccount: false,
          sanitizedBodyText: "This month in ACM-W: chapter spotlights, upcoming webinars, and scholarship deadlines.",
        },
      ],
    });
    expect(result.actionable).toBe(false);
    expect(result.tasks).toHaveLength(0);
    expect(result.needsReply).toBe(false);
    expect(classificationResultSchema.safeParse(result).success).toBe(true);
  });

  it("classifies a sponsor confirmation request as actionable with a reply", async () => {
    const { result } = await provider.classify({
      accountLabel: "rutgers.hackhers@gmail.com",
      subject: "HackHERS 2026 workshop schedule",
      storedSummary: null,
      newMessages: [
        {
          fromAddress: "sponsors@acmecorp.example",
          sentAt: "2026-08-18T15:04:00.000Z",
          isFromOrgAccount: false,
          sanitizedBodyText: "Can you confirm the 2 PM slot for our workshop on the 22nd?",
        },
      ],
    });
    expect(result.actionable).toBe(true);
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.needsReply).toBe(true);
    expect(result.suggestedReply).not.toBeNull();
    expect(classificationResultSchema.safeParse(result).success).toBe(true);
  });

  it("returns non-negative token usage", async () => {
    const { usage } = await provider.classify({
      accountLabel: "wics",
      subject: "Quick question",
      storedSummary: null,
      newMessages: [{ fromAddress: "a@example.com", sentAt: "2026-08-18T00:00:00.000Z", isFromOrgAccount: false, sanitizedBodyText: "Can you help?" }],
    });
    expect(usage.promptTokens).toBeGreaterThan(0);
    expect(usage.completionTokens).toBeGreaterThan(0);
  });
});
