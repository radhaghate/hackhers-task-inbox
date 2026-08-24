import { NextResponse } from "next/server";
import { getCurrentTeamMemberId } from "@/lib/auth/session";
import { transitionTaskStatus } from "@/lib/tasks/statusTransition";

export async function POST(_request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const actorTeamMemberId = await getCurrentTeamMemberId();
  const task = await transitionTaskStatus(taskId, "DISMISSED", actorTeamMemberId);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task });
}
