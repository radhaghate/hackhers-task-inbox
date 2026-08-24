"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Priority } from "@prisma/client";
import type { TaskWithRelations } from "@/lib/dashboard/sections";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { ConfidenceBadge } from "@/components/common/ConfidenceBadge";
import { AiSuggestionLabel } from "@/components/common/AiSuggestionLabel";
import { ReplyEditor } from "@/components/reply/ReplyEditor";
import { ReminderPanel } from "@/components/reminder/ReminderPanel";

type TeamMemberOption = { id: string; name: string; role: string | null };

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function toDateInputValue(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function TaskDetailPanel({
  task,
  teamMembers,
  onClose,
}: {
  task: TaskWithRelations;
  teamMembers: TeamMemberOption[];
  onClose: () => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [ownerId, setOwnerId] = useState(task.assignedOwnerId ?? "");
  const [notes, setNotes] = useState(task.privateNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    title !== task.title ||
    priority !== task.priority ||
    dueDate !== toDateInputValue(task.dueDate) ||
    ownerId !== (task.assignedOwnerId ?? "") ||
    notes !== (task.privateNotes ?? "");

  async function saveFields() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          priority,
          dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : null,
          assignedOwnerId: ownerId || null,
          privateNotes: notes || null,
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Could not save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function transition(action: "complete" | "dismiss" | "restore" | "waiting-for-reply") {
    setTransitioning(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Could not update status. Try again.");
    } finally {
      setTransitioning(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between border-b border-slate-200 p-4">
        <div className="flex-1">
          <input
            aria-label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-transparent px-1 py-0.5 text-base font-semibold text-slate-900 hover:border-slate-200 focus:border-slate-300"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={priority} />
            <ConfidenceBadge confidence={task.confidence} />
            <AiSuggestionLabel>AI-extracted — review fields below</AiSuggestionLabel>
          </div>
        </div>
        <button type="button" onClick={onClose} className="ml-2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <section className="grid grid-cols-2 gap-3 text-xs text-slate-500">
          <div>
            <span className="block text-slate-400">Account</span>
            {task.emailThread.gmailAccount.displayName}
          </div>
          <div>
            <span className="block text-slate-400">Sender</span>
            {task.sourceEmailMessage.fromAddress}
          </div>
          <div>
            <span className="block text-slate-400">Received</span>
            {new Date(task.sourceEmailMessage.sentAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
          </div>
          <div>
            <a
              href={`https://mail.google.com/mail/?authuser=${encodeURIComponent(task.emailThread.gmailAccount.emailAddress)}#all/${task.emailThread.gmailThreadId}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open Gmail thread ↗
            </a>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email summary</h3>
          <p className="mt-1 text-sm text-slate-700">{task.emailSummary}</p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Extracted action item</h3>
          <p className="mt-1 text-sm text-slate-700">{task.description}</p>
        </section>

        {task.dueDateSource === "INFERRED" && task.dueDateExplanation && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>Inferred due date</strong> — {task.dueDateExplanation}
          </p>
        )}

        <section className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-priority" className="block text-xs font-medium text-slate-500">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0] + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-due-date" className="block text-xs font-medium text-slate-500">
              Due date {task.dueDateSource === "INFERRED" && <span className="text-amber-600">(was inferred)</span>}
            </label>
            <input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="task-owner" className="block text-xs font-medium text-slate-500">
              Owner
            </label>
            <select
              id="task-owner"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Unassigned{task.suggestedOwnerRole ? ` (AI suggested: ${task.suggestedOwnerRole})` : ""}</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role ? ` — ${m.role}` : ""}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <label htmlFor="task-private-notes" className="block text-xs font-medium text-slate-500">
            Private notes
          </label>
          <textarea
            id="task-private-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes only your team can see"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </section>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveFields}
            disabled={!dirty || saving}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>

        <section className="border-t border-slate-200 pt-4">
          <details>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">Original email excerpt</summary>
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600">{task.originalExcerpt}</p>
          </details>
        </section>

        {task.suggestedReply && <ReplyEditor taskId={task.id} reply={task.suggestedReply} />}

        <ReminderPanel taskId={task.id} reminders={task.reminders} />

        <section className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          {task.status !== "COMPLETED" && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => transition("complete")}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              Mark complete
            </button>
          )}
          {task.status === "OPEN" && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => transition("waiting-for-reply")}
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Mark waiting for reply
            </button>
          )}
          {task.status !== "DISMISSED" && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => transition("dismiss")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Dismiss
            </button>
          )}
          {task.status === "DISMISSED" && (
            <button
              type="button"
              disabled={transitioning}
              onClick={() => transition("restore")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Restore
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
