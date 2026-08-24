import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getEnv } from "@/lib/config/env";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto/tokenCipher";
import { writeAuditEvent } from "@/lib/audit/auditLog";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { CONNECTABLE_GMAIL_ACCOUNTS, GMAIL_CONNECT_SCOPES, isConnectableAccountKey } from "@/lib/gmail/connectableAccounts";

const NONCE_COOKIE = "gmail_oauth_nonce";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state from Google" }, { status: 400 });
  }

  const [nonce, accountKey] = state.split(".");
  const cookieNonce = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${NONCE_COOKIE}=`))
    ?.split("=")[1];

  if (!nonce || nonce !== cookieNonce || !accountKey || !isConnectableAccountKey(accountKey)) {
    return NextResponse.json({ error: "Invalid or expired OAuth state" }, { status: 400 });
  }

  const env = getEnv();
  const oauth2Client = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_OAUTH_REDIRECT_URI);
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    return NextResponse.json(
      { error: "Google did not return a refresh token. Try disconnecting the app at myaccount.google.com and reconnecting." },
      { status: 400 },
    );
  }

  const target = CONNECTABLE_GMAIL_ACCOUNTS[accountKey];
  const actorTeamMemberId = await getCurrentTeamMemberId();

  const account = await prisma.gmailAccount.upsert({
    where: { emailAddress: target.emailAddress },
    update: {
      encryptedAccessToken: encryptSecret(tokens.access_token),
      encryptedRefreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: GMAIL_CONNECT_SCOPES.join(" "),
      isActive: true,
      connectedByTeamMemberId: actorTeamMemberId,
    },
    create: {
      emailAddress: target.emailAddress,
      displayName: target.displayName,
      encryptedAccessToken: encryptSecret(tokens.access_token),
      encryptedRefreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: GMAIL_CONNECT_SCOPES.join(" "),
      connectedByTeamMemberId: actorTeamMemberId,
    },
  });

  await writeAuditEvent({
    eventType: "OAUTH_CONNECTED",
    entityType: "GmailAccount",
    entityId: account.id,
    actorTeamMemberId,
    metadata: { emailAddress: account.emailAddress },
  });

  const response = NextResponse.redirect(new URL("/settings", request.url));
  response.cookies.delete(NONCE_COOKIE);
  return response;
}
