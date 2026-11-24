"use client";

import { useEffect, useState } from "react";

interface Flag {
  id: string;
  reportId: string;
  publicCode: string;
  reason: string;
  status: string;
  createdAt: string;
}

export function ModerationQueue() {
  const [flags, setFlags] = useState<Flag[] | null>(null);

  async function load() {
    const res = await fetch("/api/moderation/flags");
    const body = await res.json();
    setFlags(body.flags);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: string, status: "upheld" | "dismissed") {
    await fetch(`/api/moderation/flags/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  if (flags === null) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (flags.length === 0) return <p className="text-sm text-neutral-500">No pending flags.</p>;

  return (
    <ul className="space-y-3">
      {flags.map((f) => (
        <li key={f.id} className="rounded-lg border border-neutral-300 px-4 py-3">
          <p className="text-sm font-semibold">{f.publicCode}</p>
          <p className="mt-1 text-sm text-neutral-700">{f.reason}</p>
          <p className="mt-1 text-xs text-neutral-400">{new Date(f.createdAt).toLocaleString()}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => resolve(f.id, "upheld")} className="btn min-h-0 rounded bg-danger px-3 py-1.5 text-xs text-white">
              Uphold (take action)
            </button>
            <button onClick={() => resolve(f.id, "dismissed")} className="btn min-h-0 rounded border border-neutral-300 px-3 py-1.5 text-xs">
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
