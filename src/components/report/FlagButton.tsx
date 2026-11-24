"use client";

import { useState } from "react";

export function FlagButton({ publicCode }: { publicCode: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) return;
    const res = await fetch(`/api/reports/${publicCode}/flag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    });
    if (res.ok) setDone(true);
  }

  if (done) return <p className="text-xs text-neutral-500">Flagged for moderator review — thank you.</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn min-h-0 text-xs text-neutral-400 underline">
        Report a problem with this report
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-300 px-3 py-2">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What's wrong with this report?"
        rows={2}
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
      />
      <button type="button" onClick={submit} disabled={reason.trim().length < 5} className="btn mt-2 min-h-0 rounded bg-neutral-700 px-3 py-1.5 text-xs text-white disabled:opacity-50">
        Submit flag
      </button>
    </div>
  );
}
