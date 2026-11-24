"use client";

import { useEffect, useRef, useState } from "react";
import { listQueuedReports, removeQueuedReport } from "@/lib/offline/queue";

/**
 * Mounted once near the root. Flushes any offline-queued reports whenever
 * the browser comes back online (and once on mount, in case it's already
 * online with leftover queued drafts from a previous session).
 */
export function OfflineQueueSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  useEffect(() => {
    async function flush() {
      if (flushingRef.current || !navigator.onLine) return;
      flushingRef.current = true;
      try {
        const queued = await listQueuedReports();
        setPendingCount(queued.length);
        for (const item of queued) {
          try {
            const res = await fetch("/api/reports", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.payload),
            });
            if (res.ok || res.status === 409) {
              // 409 (possible duplicate) still removes the draft from the local
              // queue — the citizen already made that call once; retrying
              // forever on the same conflict would just loop.
              await removeQueuedReport(item.id);
            }
          } catch {
            // Still offline or request failed — leave it queued, try again next time.
          }
        }
        setPendingCount((await listQueuedReports()).length);
      } finally {
        flushingRef.current = false;
      }
    }

    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      {pendingCount} report{pendingCount > 1 ? "s" : ""} waiting to sync…
    </div>
  );
}
