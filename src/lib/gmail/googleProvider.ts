import { google } from "googleapis";
import { getEnv } from "@/lib/config/env";
import { decryptSecret } from "@/lib/crypto/tokenCipher";
import {
  GmailHistoryExpiredError,
  type CreateDraftInput,
  type FetchMessagesSinceResult,
  type GmailAccountRef,
  type GmailProvider,
} from "./types";

const BACKFILL_WINDOW_DAYS = 30;

function authorizedClient(account: GmailAccountRef) {
  if (!account.encryptedAccessToken || !account.encryptedRefreshToken) {
    throw new Error(`GmailAccount ${account.emailAddress} has no stored OAuth tokens — connect it from Settings first.`);
  }
  const env = getEnv();
  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
  oauth2Client.setCredentials({
    access_token: decryptSecret(account.encryptedAccessToken),
    refresh_token: decryptSecret(account.encryptedRefreshToken),
    expiry_date: account.tokenExpiresAt?.getTime(),
  });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function decodeBody(payload: unknown): string {
  // Gmail returns base64url-encoded bodies, and multipart messages nest
  // the text/html or text/plain part inside `parts`. We prefer text/plain,
  // fall back to text/html (sanitizeEmailBody handles HTML), and walk one
  // level of multipart nesting — enough for the plain club-inbox mail this
  // app deals with.
  type GmailPart = {
    mimeType?: string;
    body?: { data?: string | null };
    parts?: GmailPart[];
  };
  const part = payload as GmailPart | undefined;
  if (!part) return "";

  const decode = (data?: string | null) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

  if (part.body?.data) return decode(part.body.data);
  if (!part.parts) return "";

  const plain = part.parts.find((p) => p.mimeType === "text/plain");
  if (plain?.body?.data) return decode(plain.body.data);
  const html = part.parts.find((p) => p.mimeType === "text/html");
  if (html?.body?.data) return decode(html.body.data);
  for (const nested of part.parts) {
    const nestedText = decodeBody(nested);
    if (nestedText) return nestedText;
  }
  return "";
}

function headerValue(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Real Gmail API implementation. Mirrors MockGmailProvider's contract
 * exactly (see types.ts) — no send/drafts.send call exists anywhere in
 * this class.
 */
export class GoogleGmailProvider implements GmailProvider {
  async getProfile(account: GmailAccountRef): Promise<{ historyId: string }> {
    const gmail = authorizedClient(account);
    const res = await gmail.users.getProfile({ userId: "me" });
    return { historyId: String(res.data.historyId) };
  }

  async fetchMessagesSince(input: {
    account: GmailAccountRef;
    startHistoryId: string | null;
  }): Promise<FetchMessagesSinceResult> {
    const gmail = authorizedClient(input.account);

    const messageIds = new Set<string>();
    const labelOnlyThreadIds = new Set<string>();
    let newHistoryId: string;

    if (input.startHistoryId === null) {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: `newer_than:${BACKFILL_WINDOW_DAYS}d`,
        maxResults: 200,
      });
      for (const m of listRes.data.messages ?? []) {
        if (m.id) messageIds.add(m.id);
      }
      const profile = await gmail.users.getProfile({ userId: "me" });
      newHistoryId = String(profile.data.historyId);
    } else {
      let pageToken: string | undefined;
      let latestHistoryId = input.startHistoryId;
      try {
        do {
          const historyRes = await gmail.users.history.list({
            userId: "me",
            startHistoryId: input.startHistoryId,
            historyTypes: ["messageAdded"],
            pageToken,
          });
          for (const record of historyRes.data.history ?? []) {
            for (const added of record.messagesAdded ?? []) {
              if (added.message?.id) messageIds.add(added.message.id);
            }
            if (record.id) latestHistoryId = record.id;
          }
          pageToken = historyRes.data.nextPageToken ?? undefined;
        } while (pageToken);
      } catch (cause) {
        const status = (cause as { code?: number; response?: { status?: number } })?.response?.status ?? (cause as { code?: number })?.code;
        if (status === 404) {
          throw new GmailHistoryExpiredError(input.startHistoryId);
        }
        throw cause;
      }
      newHistoryId = latestHistoryId;
    }

    const messages = await Promise.all(
      [...messageIds].map(async (id) => {
        const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const msg = res.data;
        const headers = msg.payload?.headers ?? [];
        const to = headerValue(headers, "To")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          gmailMessageId: msg.id ?? id,
          gmailThreadId: msg.threadId ?? id,
          threadSubject: headerValue(headers, "Subject"),
          fromAddress: headerValue(headers, "From"),
          toAddresses: to,
          sentAt: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString(),
          snippet: msg.snippet ?? "",
          bodyText: decodeBody(msg.payload),
          historyId: String(msg.historyId ?? newHistoryId),
          isFromOrgAccount: headerValue(headers, "From").toLowerCase().includes(input.account.emailAddress.toLowerCase()),
        };
      }),
    );

    return { historyId: newHistoryId, messages, labelOnlyThreadIds: [...labelOnlyThreadIds] };
  }

  async createDraft(input: CreateDraftInput): Promise<{ draftId: string }> {
    const gmail = authorizedClient(input.account);
    const rawMessage = [
      `To: ${input.to.join(", ")}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      input.body,
    ].join("\r\n");
    const encoded = Buffer.from(rawMessage).toString("base64url");

    const res = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw: encoded, threadId: input.gmailThreadId },
      },
    });
    if (!res.data.id) throw new Error("Gmail did not return a draft id");
    return { draftId: res.data.id };
  }

  getThreadUrl(input: { emailAddress: string; gmailThreadId: string }): string {
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(input.emailAddress)}#all/${input.gmailThreadId}`;
  }
}
