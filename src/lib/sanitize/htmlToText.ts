const BLOCK_TAGS_TO_NEWLINE = /<\/(p|div|br|li|tr|h[1-6])\s*>|<br\s*\/?>/gi;

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Looks like HTML if it contains an actual tag, not just a stray angle bracket. */
export function looksLikeHtml(input: string): boolean {
  return /<\s*(html|body|div|p|br|table|span|a)\b/i.test(input);
}

/**
 * Minimal, dependency-free HTML-to-plain-text conversion. Good enough for
 * club-inbox email bodies; not a general-purpose HTML sanitizer.
 */
export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(BLOCK_TAGS_TO_NEWLINE, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  for (const [entity, char] of Object.entries(ENTITY_MAP)) {
    text = text.split(entity).join(char);
  }
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
