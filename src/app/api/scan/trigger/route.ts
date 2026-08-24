import { NextResponse } from "next/server";
import { runScan } from "@/lib/scan/orchestrator";

/**
 * Manual "Scan now" button on the dashboard. Protected the same way as
 * every other /api/* route by the auth proxy (see src/proxy.ts) — only a
 * signed-in team member can reach this.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun === true;

  const result = await runScan({ mode: dryRun ? "DRY_RUN" : "LIVE", trigger: "MANUAL_UI" });
  return NextResponse.json(result);
}
