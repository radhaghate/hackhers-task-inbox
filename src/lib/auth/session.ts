import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { isAuthDevBypassActive } from "@/lib/config/env";

const DEV_BYPASS_EMAIL = "dev@example.com";

/**
 * Resolves the acting TeamMember for the current request: the real
 * logged-in session normally, or a seeded "Dev User" when
 * AUTH_DEV_BYPASS is active (local dev / mock mode only — see env.ts,
 * which refuses to honor the bypass when NODE_ENV=production).
 */
export async function getCurrentTeamMemberId(): Promise<string | null> {
  if (isAuthDevBypassActive()) {
    const devUser = await prisma.teamMember.findUnique({ where: { email: DEV_BYPASS_EMAIL } });
    return devUser?.id ?? null;
  }
  const session = await auth();
  return session?.teamMemberId ?? null;
}

export async function getCurrentTeamMember() {
  const id = await getCurrentTeamMemberId();
  if (!id) return null;
  return prisma.teamMember.findUnique({ where: { id } });
}
