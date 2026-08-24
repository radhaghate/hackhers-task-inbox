import type { TaskWithRelations } from "@/lib/dashboard/sections";
import { PriorityBadge } from "@/components/common/PriorityBadge";

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskCard({ task, selected, onSelect }: { task: TaskWithRelations; selected: boolean; onSelect: () => void }) {
  const due = formatDate(task.dueDate);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-900 line-clamp-2">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{task.emailSummary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>{task.emailThread.gmailAccount.displayName}</span>
        {due && <span>Due {due}</span>}
        {task.assignedOwner && <span>Owner: {task.assignedOwner.name}</span>}
        {task.suggestedReply && (
          <span className="text-violet-600">{task.suggestedReply.gmailDraftId ? "Draft created" : "Reply suggested"}</span>
        )}
      </div>
    </button>
  );
}
