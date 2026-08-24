import { getTasksGroupedBySection } from "@/lib/dashboard/sections";
import { prisma } from "@/lib/db/prisma";
import { getCurrentTeamMember } from "@/lib/auth/session";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const [grouped, teamMembers, currentUser] = await Promise.all([
    getTasksGroupedBySection(),
    prisma.teamMember.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
    getCurrentTeamMember(),
  ]);

  return <DashboardClient grouped={grouped} teamMembers={teamMembers} currentUserName={currentUser?.name ?? null} />;
}
