"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function SupportButton({ publicCode, initialCount }: { publicCode: string; initialCount: number }) {
  const t = useTranslations();
  const [count, setCount] = useState(initialCount);
  const [done, setDone] = useState(false);

  async function support() {
    const res = await fetch(`/api/reports/${publicCode}/supporters`, { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      setCount(body.supporterCount);
      setDone(true);
    }
  }

  return (
    <button
      type="button"
      onClick={support}
      disabled={done}
      className="btn flex items-center gap-2 rounded-lg border-2 border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-60"
    >
      {t("map.supporters", { count })}
    </button>
  );
}
