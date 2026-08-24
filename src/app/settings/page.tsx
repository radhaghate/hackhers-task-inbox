import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/config/env";
import { CONNECTABLE_GMAIL_ACCOUNTS } from "@/lib/gmail/connectableAccounts";

export default async function SettingsPage() {
  const env = getEnv();
  const accounts = await prisma.gmailAccount.findMany();
  const byEmail = new Map(accounts.map((a) => [a.emailAddress, a]));
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_OAUTH_REDIRECT_URI);

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-slate-900">Connected Gmail accounts</h1>
      <p className="mt-1 text-sm text-slate-500">
        Currently running with <code className="rounded bg-slate-100 px-1 py-0.5">GMAIL_PROVIDER={env.GMAIL_PROVIDER}</code>.
        {env.GMAIL_PROVIDER === "mock" && " The dashboard is populated from mock fixtures — connect a real account below to switch to live Gmail data."}
      </p>

      {!googleConfigured && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Google OAuth isn&apos;t configured yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI). See README.md
          &quot;Google Cloud setup&quot; to enable real Gmail connections.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {Object.entries(CONNECTABLE_GMAIL_ACCOUNTS).map(([key, target]) => {
          const account = byEmail.get(target.emailAddress);
          const connected = Boolean(account?.encryptedRefreshToken);
          return (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{target.displayName}</p>
                <p className="text-xs text-slate-500">{target.emailAddress}</p>
                {account?.lastSuccessfulScanAt && (
                  <p className="mt-1 text-xs text-slate-400">Last scan: {new Date(account.lastSuccessfulScanAt).toLocaleString()}</p>
                )}
              </div>
              {connected ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Connected</span>
              ) : (
                <a
                  href={googleConfigured ? `/api/oauth/google/start?account=${key}` : "#"}
                  aria-disabled={!googleConfigured}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${
                    googleConfigured ? "bg-slate-900 hover:bg-slate-800" : "cursor-not-allowed bg-slate-300"
                  }`}
                >
                  Connect
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        This app requests read-only Gmail access plus draft creation only (gmail.readonly + gmail.compose) — it can
        never send email on your behalf.
      </p>
    </div>
  );
}
