import { getEnv } from "@/lib/config/env";
import { htmlToText, looksLikeHtml } from "./htmlToText";
import { stripQuotedReplies } from "./stripQuotedReplies";
import { stripSignature } from "./stripSignature";
import { stripTrackingLinks } from "./stripTrackingLinks";

const TRUNCATION_SUFFIX = "\n\n[…truncated]";

/**
 * Converts a raw Gmail message body into the compact, model-safe text we
 * actually persist and send to the LLM: HTML stripped to plain text,
 * quoted history and signatures removed, tracking links cleaned, and
 * capped at MAX_EMAIL_BODY_CHARS with a safe (non-mid-word) truncation.
 */
export function sanitizeEmailBody(rawBody: string): string {
  let text = looksLikeHtml(rawBody) ? htmlToText(rawBody) : rawBody;
  text = stripQuotedReplies(text);
  text = stripSignature(text);
  text = stripTrackingLinks(text);
  text = text.trim();

  const maxChars = getEnv().MAX_EMAIL_BODY_CHARS;
  if (text.length <= maxChars) return text;

  const budget = maxChars - TRUNCATION_SUFFIX.length;
  const truncated = text.slice(0, Math.max(budget, 0));
  const lastSpace = truncated.lastIndexOf(" ");
  const safe = lastSpace > budget * 0.8 ? truncated.slice(0, lastSpace) : truncated;
  return `${safe}${TRUNCATION_SUFFIX}`;
}
