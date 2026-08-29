import { describe, expect, it } from "vitest";
import { passesAccountTopicFilter } from "@/lib/sync/topicFilter";

const HACKHERS_EMAIL = "rutgers.hackhers@gmail.com";
const WICS_EMAIL = "rutgerswics@gmail.com";

function message(overrides: Partial<{ threadSubject: string; snippet: string; bodyText: string }> = {}) {
  return { threadSubject: "", snippet: "", bodyText: "", ...overrides };
}

describe("passesAccountTopicFilter", () => {
  it("has no filter for the HackHERS account — everything passes", () => {
    expect(passesAccountTopicFilter(HACKHERS_EMAIL, message({ threadSubject: "Venue AV setup form" }))).toBe(true);
    expect(passesAccountTopicFilter(HACKHERS_EMAIL, message({ threadSubject: "Totally unrelated newsletter" }))).toBe(true);
  });

  it("blocks WiCS mail that doesn't mention HackHERS", () => {
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ threadSubject: "Guest speaker for spring kickoff?" }))).toBe(false);
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ threadSubject: "W9 for sponsorship payment" }))).toBe(false);
  });

  it("allows WiCS mail that mentions HackHERS, matched case-insensitively and in any field", () => {
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ threadSubject: "Need HackHERS volunteers" }))).toBe(true);
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ threadSubject: "hackhers check-in" }))).toBe(true);
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ snippet: "on behalf of HACKHERS" }))).toBe(true);
    expect(passesAccountTopicFilter(WICS_EMAIL, message({ bodyText: "co-hosted with Hack Hers this year" }))).toBe(true);
  });
});
