import { describe, expect, it } from "vitest";
import { computeCandidateThreadIds } from "@/lib/sync/materialChange";

describe("computeCandidateThreadIds", () => {
  it("flags a thread with a new message as a candidate", () => {
    const ids = computeCandidateThreadIds([{ emailThreadId: "t1", messageCount: 2, lastClassifiedMessageCount: 1 }]);
    expect(ids).toEqual(["t1"]);
  });

  it("does not flag a thread with no new messages (label-only change)", () => {
    const ids = computeCandidateThreadIds([{ emailThreadId: "t1", messageCount: 2, lastClassifiedMessageCount: 2 }]);
    expect(ids).toEqual([]);
  });

  it("flags a brand-new thread (never classified) as a candidate", () => {
    const ids = computeCandidateThreadIds([{ emailThreadId: "t1", messageCount: 1, lastClassifiedMessageCount: 0 }]);
    expect(ids).toEqual(["t1"]);
  });

  it("handles a mix of candidate and non-candidate threads", () => {
    const ids = computeCandidateThreadIds([
      { emailThreadId: "t1", messageCount: 2, lastClassifiedMessageCount: 2 },
      { emailThreadId: "t2", messageCount: 3, lastClassifiedMessageCount: 1 },
      { emailThreadId: "t3", messageCount: 1, lastClassifiedMessageCount: 0 },
    ]);
    expect(ids.sort()).toEqual(["t2", "t3"]);
  });
});
