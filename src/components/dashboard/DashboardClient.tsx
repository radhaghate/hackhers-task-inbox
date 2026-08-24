"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DashboardSection, TaskWithRelations } from "@/lib/dashboard/sections";
import { TaskCard } from "./TaskCard";
import { TaskDetailPanel } from "@/components/task-detail/TaskDetailPanel";

const SECTION_LABELS: Record<DashboardSection, string> = {
  needsAttention: "Needs Attention",
  upcoming: "Upcoming",
  waitingForReply: "Waiting for Reply",
  completed: "Completed",
  ignored: "Ignored",
};

const SECTION_ORDER: DashboardSection[] = ["needsAttention", "upcoming", "waitingForReply", "completed", "ignored"];

type TeamMemberOption = { id: string; name: string; role: string | null };

export function DashboardClient({
  grouped,
  teamMembers,
  currentUserName,
}: {
  grouped: Record<DashboardSection, TaskWithRelations[]>;
  teamMembers: TeamMemberOption[];
  currentUserName: string | null;
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<DashboardSection>("needsAttention");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const activeTasks = grouped[activeSection];
  const selectedTask = useMemo(
    () => Object.values(grouped).flat().find((t) => t.id === selectedTaskId) ?? null,
    [grouped, selectedTaskId],
  );

  async function triggerScan() {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await fetch("/api/scan/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = await res.json();
      setScanMessage(res.ok ? `Scan ${data.status}.` : "Scan failed — see server logs.");
      router.refresh();
    } catch {
      setScanMessage("Scan failed to start.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">HackHERS Task Inbox</h1>
          <p className="text-xs text-slate-500">
            {currentUserName ? `Signed in as ${currentUserName}` : "Not signed in"} — AI classifications and replies are suggestions; review before acting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scanMessage && <span className="text-xs text-slate-500">{scanMessage}</span>}
          <Link href="/settings" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Settings
          </Link>
          <button
            type="button"
            onClick={triggerScan}
            disabled={scanning}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-6">
        {SECTION_ORDER.map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => {
              setActiveSection(section);
              setSelectedTaskId(null);
            }}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeSection === section ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {SECTION_LABELS[section]}
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{grouped[section].length}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-full max-w-md flex-shrink-0 overflow-y-auto border-r border-slate-200 p-4">
          {activeTasks.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-400">Nothing here.</p>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
                <TaskCard key={task.id} task={task} selected={task.id === selectedTaskId} onSelect={() => setSelectedTaskId(task.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {selectedTask ? (
            <TaskDetailPanel key={`${selectedTask.id}-${selectedTask.updatedAt}`} task={selectedTask} teamMembers={teamMembers} onClose={() => setSelectedTaskId(null)} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Select a task to see details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
