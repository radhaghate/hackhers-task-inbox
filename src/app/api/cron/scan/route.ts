import { NextResponse } from "next/server";
import { getEnv } from "@/lib/config/env";
import { runScan } from "@/lib/scan/orchestrator";

/**
 * Called by an external scheduler (Vercel Cron, GitHub Actions cron, a
 * Supabase scheduled function, ...) every SCAN_INTERVAL_DAYS — see
 * README.md "Production scheduling". Authenticated by a shared secret
 * header rather than a browser session, since there's no logged-in user
 * on this path; this is also why it's exempted from the auth proxy in
 * src/proxy.ts rather than gated by it.
 */
export async function POST(request: Request) {
  const env = getEnv();
  const providedSecret = request.headers.get("x-cron-secret");

  if (!env.CRON_SECRET || providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runScan({ mode: "LIVE", trigger: "CRON" });
  return NextResponse.json(result);
}
