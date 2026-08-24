"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Reminder } from "@prisma/client";

function toLocalInputValue(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function ReminderPanel({ taskId, reminders }: { taskId: string; reminders: Reminder[] }) {
  const router = useRouter();
  const [remindAt, setRemindAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = reminders.filter((r) => r.status === "PENDING");

  async function schedule() {
    if (!remindAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, remindAt: new Date(remindAt).toISOString(), note: note || null }),
      });
      if (!res.ok) throw new Error();
      setRemindAt("");
      setNote("");
      router.refresh();
    } catch {
      setError("Could not schedule reminder.");
    } finally {
      setSaving(false);
    }
  }

  async function dismiss(reminderId: string) {
    await fetch(`/api/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DISMISSED" }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">Reminders</h3>
      <p className="mt-0.5 text-xs text-slate-500">In-app only — a reminder never sends anything on its own, it just resurfaces this task.</p>

      {pending.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="text-slate-700">
                {new Date(r.remindAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                {r.note && <span className="text-slate-400"> — {r.note}</span>}
              </span>
              <button type="button" onClick={() => dismiss(r.id)} className="text-slate-400 hover:text-slate-700">
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500">Remind me at</label>
          <input
            type="datetime-local"
            value={remindAt}
            min={toLocalInputValue(new Date())}
            onChange={(e) => setRemindAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500">Note (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Review reply before sending"
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={schedule}
          disabled={!remindAt || saving}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Schedule
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
