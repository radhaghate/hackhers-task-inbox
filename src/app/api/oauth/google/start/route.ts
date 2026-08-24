import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getEnv } from "@/lib/config/env";
import { CONNECTABLE_GMAIL_ACCOUNTS, GMAIL_CONNECT_SCOPES, isConnectableAccountKey } from "@/lib/gmail/connectableAccounts";

const NONCE_COOKIE = "gmail_oauth_nonce";

/**
 * Starts the Gmail-account-connect OAuth flow for one of the two known
 * accounts (?account=hackhers|wics). Distinct from team-member login
 * (src/auth.ts) — this requests gmail.readonly + gmail.compose, never
 * openid/profile, and only ever writes to GmailAccount, never to a login
 * session. Reachable only by a signed-in team member (not in the auth
 * proxy's public-path allowlist).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const accountKey = url.searchParams.get("account");
  if (!accountKey || !isConnectableAccountKey(accountKey)) {
    return NextResponse.json({ error: "Unknown account. Expected ?account=hackhers or ?account=wics" }, { status: 400 });
  }

  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    return NextResponse.json({ error: "Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)" }, { status: 500 });
  }

  const nonce = randomBytes(16).toString("hex");
  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is returned even on re-connect
    scope: GMAIL_CONNECT_SCOPES,
    state: `${nonce}.${accountKey}`,
    login_hint: CONNECTABLE_GMAIL_ACCOUNTS[accountKey].emailAddress,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(NONCE_COOKIE, nonce, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
