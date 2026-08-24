import { describe, expect, it } from "vitest";
import { computeSection } from "@/lib/dashboard/sections";

const now = new Date("2026-08-24T12:00:00.000Z");

describe("computeSection", () => {
  it("completed status always maps to completed, regardless of priority", () => {
    expect(computeSection({ status: "COMPLETED", priority: "URGENT", dueDate: null }, now)).toBe("completed");
  });

  it("dismissed status always maps to ignored", () => {
    expect(computeSection({ status: "DISMISSED", priority: "LOW", dueDate: null }, now)).toBe("ignored");
  });

  it("waiting-for-reply status maps to waitingForReply even if urgent", () => {
    expect(computeSection({ status: "WAITING_FOR_REPLY", priority: "URGENT", dueDate: null }, now)).toBe("waitingForReply");
  });

  it("open + high/urgent priority maps to needsAttention", () => {
    expect(computeSection({ status: "OPEN", priority: "HIGH", dueDate: null }, now)).toBe("needsAttention");
    expect(computeSection({ status: "OPEN", priority: "URGENT", dueDate: null }, now)).toBe("needsAttention");
  });

  it("open + low/medium priority with no due date maps to upcoming", () => {
    expect(computeSection({ status: "OPEN", priority: "LOW", dueDate: null }, now)).toBe("upcoming");
    expect(computeSection({ status: "OPEN", priority: "MEDIUM", dueDate: null }, now)).toBe("upcoming");
  });

  it("open + low priority but due within the window maps to needsAttention", () => {
    const dueSoon = new Date("2026-08-25T12:00:00.000Z"); // 1 day out, window default 2
    expect(computeSection({ status: "OPEN", priority: "LOW", dueDate: dueSoon }, now)).toBe("needsAttention");
  });

  it("open + low priority with a due date far in the future maps to upcoming", () => {
    const dueFar = new Date("2026-12-01T12:00:00.000Z");
    expect(computeSection({ status: "OPEN", priority: "LOW", dueDate: dueFar }, now)).toBe("upcoming");
  });

  it("open + low priority with an overdue due date maps to needsAttention", () => {
    const overdue = new Date("2026-08-01T12:00:00.000Z");
    expect(computeSection({ status: "OPEN", priority: "LOW", dueDate: overdue }, now)).toBe("needsAttention");
  });
});
