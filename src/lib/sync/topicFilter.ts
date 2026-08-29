import { CONNECTABLE_GMAIL_ACCOUNTS } from "@/lib/gmail/connectableAccounts";
import type { GmailMessageRecord } from "@/lib/gmail/types";

/**
 * Per-account keyword filters applied during sync, before anything is
 * persisted or reaches classification. Only the WiCS inbox is restricted —
 * that account handles general WiCS club business as well as HackHERS
 * matters, and this tool should only ever surface the HackHERS-related
 * subset of it. The HackHERS account itself is unfiltered.
 *
 * This is deliberately a cheap, deterministic string match rather than an
 * LLM call — it's a pre-filter, so it should never cost a model call to
 * decide whether something is even worth classifying.
 */
const ACCOUNT_TOPIC_FILTERS: Partial<Record<string, RegExp>> = {
  [CONNECTABLE_GMAIL_ACCOUNTS.wics.emailAddress]: /hack\s*hers?/i,
};

/**
 * Returns true if `message` should proceed to be stored/classified for the
 * given account's inbox. Accounts with no configured filter keep everything
 * (the default, unrestricted behavior).
 */
export function passesAccountTopicFilter(accountEmailAddress: string, message: Pick<GmailMessageRecord, "threadSubject" | "snippet" | "bodyText">): boolean {
  const filter = ACCOUNT_TOPIC_FILTERS[accountEmailAddress];
  if (!filter) return true;
  return filter.test(message.threadSubject) || filter.test(message.snippet) || filter.test(message.bodyText);
}
