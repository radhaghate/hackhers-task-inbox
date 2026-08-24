// Markers that, once seen, mean "everything from here on is quoted history
// from a previous message" — we cut the body there rather than sending the
// whole thread's history to the model on every scan.
const QUOTE_START_PATTERNS: RegExp[] = [
  /^On .{0,120} wrote:\s*$/im, // Gmail/Apple Mail: "On <date>, <name> wrote:"
  /^-{2,}\s*Original Message\s*-{2,}/im, // Outlook
  /^_{10,}\s*$/m, // Outlook horizontal rule separator
  /^From:\s?.+\n(Sent|Date):\s?.+\n(To|Cc):\s?.+\n(Cc:.+\n)?Subject:\s?.+/im, // Outlook forward/reply header block
  /^-{2,}\s*Forwarded message\s*-{2,}/im, // Gmail forward
  /^>\s?.+$/m, // conventional ">" quoted lines (matches the first one)
];

/**
 * Cuts an email body at the first point it starts quoting a previous
 * message, so only the genuinely new content in a reply is kept.
 */
export function stripQuotedReplies(body: string): string {
  let cutIndex = body.length;
  for (const pattern of QUOTE_START_PATTERNS) {
    const match = pattern.exec(body);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }
  return body.slice(0, cutIndex).trimEnd();
}
