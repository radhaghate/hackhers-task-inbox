import { isAuthDevBypassActive } from "@/lib/config/env";
import { signIn } from "@/auth";

export default function LoginPage() {
  const devBypass = isAuthDevBypassActive();

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">HackHERS Task Inbox</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in with your club Google account to continue.</p>

        {devBypass ? (
          <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            AUTH_DEV_BYPASS is on — you should already be signed in as the seeded Dev User. This page should only
            appear if that bypass is disabled.
          </p>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Sign in with Google
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
