import { randomUUID } from "node:crypto";
import {
  GmailHistoryExpiredError,
  type CreateDraftInput,
  type FetchMessagesSinceResult,
  type GmailAccountRef,
  type GmailProvider,
} from "./types";
import hackhersFixture from "./fixtures/hackhers-inbox.snapshots.json";
import wicsFixture from "./fixtures/wics-inbox.snapshots.json";

type FixtureSnapshot = {
  historyId: string;
  messages: FixtureMessage[];
  labelOnlyThreadIds: string[];
};

type FixtureMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  threadSubject: string;
  fromAddress: string;
  toAddresses: string[];
  sentAt: string;
  snippet: string;
  bodyText: string;
  historyId: string;
  isFromOrgAccount: boolean;
};

type Fixture = { emailAddress: string; snapshots: FixtureSnapshot[] };

const FIXTURES: Fixture[] = [hackhersFixture as Fixture, wicsFixture as Fixture];

function fixtureFor(emailAddress: string): Fixture {
  const fixture = FIXTURES.find((f) => f.emailAddress === emailAddress);
  if (!fixture) {
    throw new Error(`No mock Gmail fixture registered for account ${emailAddress}`);
  }
  return fixture;
}

/**
 * Deterministic, fixture-driven GmailProvider so the whole app — dashboard,
 * scan pipeline, tests — works with zero real Google credentials.
 * Stateless: behavior is entirely a function of the fixture data plus the
 * `startHistoryId` the caller passes in (itself the DB-persisted cursor),
 * so repeated scans against the same DB demonstrate real incremental sync.
 */
export class MockGmailProvider implements GmailProvider {
  async getProfile(account: GmailAccountRef): Promise<{ historyId: string }> {
    const fixture = fixtureFor(account.emailAddress);
    const latest = fixture.snapshots.at(-1);
    if (!latest) throw new Error(`Mock fixture for ${account.emailAddress} has no snapshots`);
    return { historyId: latest.historyId };
  }

  async fetchMessagesSince(input: {
    account: GmailAccountRef;
    startHistoryId: string | null;
  }): Promise<FetchMessagesSinceResult> {
    const fixture = fixtureFor(input.account.emailAddress);
    const { snapshots } = fixture;

    if (input.startHistoryId === null) {
      // First sync: a bounded backfill reflects the mailbox's CURRENT
      // state (mirrors real Gmail's `messages.list`, which has no notion
      // of "snapshots" — it just returns what's in the mailbox right
      // now), so this returns every fixture message across all layers,
      // watermarked at the latest historyId. Layers only matter for the
      // startHistoryId-provided branch below, which simulates mail that
      // arrives *after* an account has already been synced once.
      const latest = snapshots.at(-1);
      if (!latest) return { historyId: "0", messages: [], labelOnlyThreadIds: [] };
      return {
        historyId: latest.historyId,
        messages: snapshots.flatMap((s) => s.messages),
        labelOnlyThreadIds: snapshots.flatMap((s) => s.labelOnlyThreadIds),
      };
    }

    const startIndex = snapshots.findIndex((s) => s.historyId === input.startHistoryId);
    if (startIndex === -1) {
      throw new GmailHistoryExpiredError(input.startHistoryId);
    }

    const remaining = snapshots.slice(startIndex + 1);
    const latestHistoryId = remaining.length > 0 ? remaining.at(-1)!.historyId : input.startHistoryId;
    return {
      historyId: latestHistoryId,
      messages: remaining.flatMap((s) => s.messages),
      labelOnlyThreadIds: remaining.flatMap((s) => s.labelOnlyThreadIds),
    };
  }

  // Signature must match GmailProvider.createDraft; the mock doesn't need
  // any of the input to fabricate a plausible draft id.
  async createDraft(input: CreateDraftInput): Promise<{ draftId: string }> {
    void input;
    return { draftId: `mock-draft-${randomUUID()}` };
  }

  getThreadUrl(input: { emailAddress: string; gmailThreadId: string }): string {
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(input.emailAddress)}#all/${input.gmailThreadId}`;
  }
}
