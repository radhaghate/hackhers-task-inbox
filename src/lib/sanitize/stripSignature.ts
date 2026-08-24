// RFC 3676 standard signature delimiter, plus common footers seen in club
// inbox mail (mobile client footers, calendar-invite boilerplate).
const SIGNATURE_START_PATTERNS: RegExp[] = [
  /^--\s*$/m, // RFC 3676 "-- " signature delimiter
  /^Sent from my (iPhone|iPad|Android|Galaxy|mobile device)/im,
  /^Get Outlook for (iOS|Android)/im,
  /^\[image:.*logo.*\]/im,
];

/**
 * Cuts an email body at the start of a trailing signature block so
 * boilerplate (names, titles, phone numbers, disclaimers) isn't sent to
 * the model as if it were message content.
 */
export function stripSignature(body: string): string {
  let cutIndex = body.length;
  for (const pattern of SIGNATURE_START_PATTERNS) {
    const match = pattern.exec(body);
    if (match && match.index < cutIndex) {
      cutIndex = match.index;
    }
  }
  return body.slice(0, cutIndex).trimEnd();
}
