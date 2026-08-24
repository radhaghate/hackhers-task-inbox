import { describe, expect, it } from "vitest";
import { filterUnseenMessages } from "@/lib/sync/dedupe";
import type { GmailMessageRecord } from "@/lib/gmail/types";

function msg(id: string): GmailMessageRecord {
  return {
    gmailMessageId: id,
    gmailThreadId: "thread-1",
    threadSubject: "Subject",
    fromAddress: "a@example.com",
    toAddresses: ["b@example.com"],
    sentAt: "2026-08-18T00:00:00.000Z",
    snippet: "snippet",
    bodyText: "body",
    historyId: "1",
    isFromOrgAccount: false,
  };
}

describe("filterUnseenMessages", () => {
  it("keeps messages whose id is not already stored", () => {
    const result = filterUnseenMessages([msg("a"), msg("b")], new Set());
    expect(result.map((m) => m.gmailMessageId)).toEqual(["a", "b"]);
  });

  it("drops messages whose id is already stored", () => {
    const result = filterUnseenMessages([msg("a"), msg("b"), msg("c")], new Set(["b"]));
    expect(result.map((m) => m.gmailMessageId)).toEqual(["a", "c"]);
  });

  it("returns an empty array when everything is already seen", () => {
    const result = filterUnseenMessages([msg("a"), msg("b")], new Set(["a", "b"]));
    expect(result).toEqual([]);
  });
});
