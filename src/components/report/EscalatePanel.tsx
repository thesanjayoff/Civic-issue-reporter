"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const STEPS = ["reminder", "zonal", "regional", "state_grievance", "central_grievance", "rti"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABEL_KEY: Record<Step, string> = {
  reminder: "escalation.stepReminder",
  zonal: "escalation.stepZonal",
  regional: "escalation.stepRegional",
  state_grievance: "escalation.stepStateGrievance",
  central_grievance: "escalation.stepCentralGrievance",
  rti: "escalation.stepRti",
};

export function EscalatePanel({ publicCode }: { publicCode: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<Step>("reminder");
  const [message, setMessage] = useState<{ subjectEn: string; bodyEn: string; subjectTa: string; bodyTa: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadMessage(nextStep: Step) {
    setStep(nextStep);
    setLoading(true);
    setCopied(false);
    const res = await fetch(`/api/reports/${publicCode}/escalate?step=${nextStep}`);
    setLoading(false);
    if (res.ok) {
      const body = await res.json();
      setMessage(body.message);
    }
  }

  async function copyAndRecord() {
    if (!message) return;
    await navigator.clipboard.writeText(`${message.subjectEn}\n\n${message.bodyEn}\n\n---\n${message.subjectTa}\n\n${message.bodyTa}`);
    setCopied(true);
    await fetch(`/api/reports/${publicCode}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, sentVia: "copied" }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-neutral-300 px-4 py-3">
      <h3 className="text-sm font-semibold">{t("escalation.title")}</h3>
      <p className="mt-1 text-xs text-neutral-500">{t("escalation.sendPrompt")}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => loadMessage(s)}
            className={`btn min-h-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              step === s ? "border-brand bg-brand/10 text-brand" : "border-neutral-300 text-neutral-600"
            }`}
          >
            {t(STEP_LABEL_KEY[s])}
          </button>
        ))}
      </div>

      {loading && <p className="mt-3 text-sm text-neutral-500">{t("common.loading")}</p>}

      {message && !loading && (
        <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-3 text-sm">
          <p className="font-semibold">{message.subjectEn}</p>
          <p className="mt-1 whitespace-pre-wrap text-neutral-700">{message.bodyEn}</p>
          <button onClick={copyAndRecord} className="btn mt-3 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      )}
    </div>
  );
}
