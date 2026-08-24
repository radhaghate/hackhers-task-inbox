"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SuggestedReply } from "@prisma/client";
import { AiSuggestionLabel } from "@/components/common/AiSuggestionLabel";

export function ReplyEditor({ taskId, reply }: { taskId: string; reply: SuggestedReply }) {
  const router = useRouter();
  const [subject, setSubject] = useState(reply.subject);
  const [body, setBody] = useState(reply.body);
  const [saving, setSaving] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = subject !== reply.subject || body !== reply.body;
  const draftAlreadyCreated = Boolean(reply.gmailDraftId);

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/replies/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) throw new Error("Failed to save reply");
      router.refresh();
    } catch {
      setError("Could not save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function approveDraft() {
    setCreatingDraft(true);
    setError(null);
    try {
      const res = await fetch(`/api/replies/${taskId}/create-draft`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create draft");
      }
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create draft");
    } finally {
      setCreatingDraft(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Suggested reply</h3>
        <AiSuggestionLabel>{reply.isEdited ? "AI draft, edited by a team member" : "AI-generated suggestion — review before sending"}</AiSuggestionLabel>
      </div>

      {draftAlreadyCreated && (
        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Gmail draft created ({reply.gmailDraftId}). Open Gmail to review and send it — this app never sends email automatically.
        </p>
      )}

      <label className="mt-3 block text-xs font-medium text-slate-500">Subject</label>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        disabled={draftAlreadyCreated}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
      />

      <label className="mt-3 block text-xs font-medium text-slate-500">Body</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={draftAlreadyCreated}
        rows={6}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
      />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {!draftAlreadyCreated && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={saveChanges}
            disabled={!dirty || saving}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save edits"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Create Gmail draft…
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg">
            <h4 className="text-sm font-semibold text-slate-900">Create a Gmail draft?</h4>
            <p className="mt-2 text-xs text-slate-500">
              This creates a draft in the connected Gmail account for a human to review and send manually. No email
              is ever sent automatically.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={approveDraft}
                disabled={creatingDraft}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {creatingDraft ? "Creating…" : "Yes, create draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
