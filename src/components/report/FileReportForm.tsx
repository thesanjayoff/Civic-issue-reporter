"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function FileReportForm({ publicCode, agencyName }: { publicCode: string; agencyName: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [refNumber, setRefNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!refNumber.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/reports/${publicCode}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officialReferenceNumber: refNumber.trim() }),
    });
    setSubmitting(false);
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-neutral-300 px-4 py-3">
      <h3 className="text-sm font-semibold">{t("filing.title", { agency: agencyName })}</h3>
      <p className="mt-1 text-xs text-neutral-500">{t("filing.noReferenceYet")}</p>
      <label className="mt-2 block text-sm">
        {t("filing.referenceNumberLabel")}
        <input
          type="text"
          value={refNumber}
          onChange={(e) => setRefNumber(e.target.value)}
          placeholder={t("filing.referenceNumberPlaceholder")}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
        />
      </label>
      <button type="submit" disabled={submitting || !refNumber.trim()} className="btn mt-3 w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60">
        {t("common.save")}
      </button>
    </form>
  );
}
