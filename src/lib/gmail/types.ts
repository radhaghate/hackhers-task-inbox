/**
 * Everything needed to act on a connected Gmail inbox. Tokens are the
 * still-encrypted values from the GmailAccount row — implementations
 * decrypt them internally, never returning plaintext tokens to callers.
 */
export type GmailAccountRef = {
  emailAddress: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: Date | null;
};

export type GmailMessageRecord = {
  gmailMessageId: string;
  gmailThreadId: string;
  threadSubject: string;
  fromAddress: string;
  toAddresses: string[];
  sentAt: string; // ISO 8601
  snippet: string;
  /** Raw body as Gmail returned it (may be HTML) — sanitized by the caller before use. */
  bodyText: string;
  historyId: string;
  isFromOrgAccount: boolean;
};

export type FetchMessagesSinceResult = {
  /** New watermark to persist as GmailAccount.lastHistoryId after this call. */
  historyId: string;
  messages: GmailMessageRecord[];
  /** Threads that changed (e.g. label/read-state) with no new message — informational, used to prove material-change detection correctly ignores them. */
  labelOnlyThreadIds: string[];
};

export type CreateDraftInput = {
  account: GmailAccountRef;
  gmailThreadId: string;
  to: string[];
  subject: string;
  body: string;
};

/**
 * Thrown by fetchMessagesSince when a non-null startHistoryId is no longer
 * valid (Gmail retains history for ~1 week; a real 404 from history.list
 * maps to this, and MockGmailProvider throws it when a startHistoryId
 * isn't found in its fixtures). Callers should fall back to a fresh
 * first-sync backfill.
 */
export class GmailHistoryExpiredError extends Error {
  constructor(startHistoryId: string) {
    super(`startHistoryId ${startHistoryId} is no longer valid (history expired)`);
    this.name = "GmailHistoryExpiredError";
  }
}

/**
 * Everything the app can do to a Gmail inbox. Deliberately has NO method
 * that sends or otherwise dispatches a message (no `sendMessage`, no
 * `sendDraft`) — sending is not just policy-forbidden but structurally
 * absent from this interface, so no call site anywhere in the codebase
 * can invoke it, mock or real.
 */
export interface GmailProvider {
  getProfile(account: GmailAccountRef): Promise<{ historyId: string }>;

  /**
   * `startHistoryId: null` means "first sync" — implementations should do
   * a bounded backfill (e.g. `newer_than:30d`) rather than the full
   * mailbox. Otherwise behaves like Gmail's `history.list`.
   */
  fetchMessagesSince(input: {
    account: GmailAccountRef;
    startHistoryId: string | null;
  }): Promise<FetchMessagesSinceResult>;

  /** The only place a Gmail draft is ever created — never sent. */
  createDraft(input: CreateDraftInput): Promise<{ draftId: string }>;

  getThreadUrl(input: { emailAddress: string; gmailThreadId: string }): string;
}
