import { describe, expect, it } from "vitest";
import { sanitizeEmailBody } from "@/lib/sanitize/emailSanitizer";

describe("sanitizeEmailBody", () => {
  it("strips quoted reply history", () => {
    const body = "Sure, 2pm works for us.\n\nOn Mon, Jan 5, 2026 at 3:00 PM Jane Doe wrote:\n> What time works?";
    expect(sanitizeEmailBody(body)).toBe("Sure, 2pm works for us.");
  });

  it("strips a trailing signature block", () => {
    const body = "Confirming the venue for Saturday.\n\n--\nJane Doe\nSponsorship Lead\n555-0100";
    expect(sanitizeEmailBody(body)).toBe("Confirming the venue for Saturday.");
  });

  it("strips utm tracking params from links but keeps the base URL", () => {
    const body = "See details: https://example.com/event?utm_source=newsletter&utm_medium=email&id=42";
    expect(sanitizeEmailBody(body)).toBe("See details: https://example.com/event?id=42");
  });

  it("converts simple HTML to plain text", () => {
    const body = "<p>Hi team,</p><p>Please confirm by <b>Friday</b>.</p>";
    expect(sanitizeEmailBody(body)).toBe("Hi team,\nPlease confirm by Friday.");
  });

  it("truncates very long bodies at a safe boundary with a marker", () => {
    const longBody = Array.from({ length: 2000 }, () => "word").join(" ");
    const result = sanitizeEmailBody(longBody);
    expect(result.length).toBeLessThanOrEqual(6000);
    expect(result.endsWith("[…truncated]")).toBe(true);
    expect(result).not.toMatch(/wo\[/); // never cuts mid-word
  });

  it("leaves a short plain-text body untouched", () => {
    const body = "Can you send the sponsor deck by Thursday?";
    expect(sanitizeEmailBody(body)).toBe(body);
  });
});
