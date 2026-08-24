// The two Gmail inboxes this app connects to. Keyed by a short slug
// (rather than trusting an arbitrary email address from a query param)
// so the OAuth-connect flow can only ever target one of these two.
export const CONNECTABLE_GMAIL_ACCOUNTS = {
  hackhers: { emailAddress: "rutgers.hackhers@gmail.com", displayName: "HackHERS" },
  wics: { emailAddress: "rutgerswics@gmail.com", displayName: "Rutgers WiCS" },
} as const;

export type ConnectableAccountKey = keyof typeof CONNECTABLE_GMAIL_ACCOUNTS;

export function isConnectableAccountKey(value: string): value is ConnectableAccountKey {
  return value in CONNECTABLE_GMAIL_ACCOUNTS;
}

// Read-only + draft-creation only — never gmail.send or gmail.modify.
export const GMAIL_CONNECT_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"];
