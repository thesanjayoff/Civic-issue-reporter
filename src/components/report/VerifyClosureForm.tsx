"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

type Outcome = "verified_fixed" | "partially_fixed" | "not_fixed_disputed" | "cannot_verify";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function VerifyClosureForm({ publicCode }: { publicCode: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mismatchNote, setMismatchNote] = useState<string | null>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoDataUrl(await readFileAsDataUrl(file));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) =>
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
      );
    }
  }

  async function submit(outcome: Outcome) {
    setSubmitting(true);
    setMismatchNote(null);
    const res = await fetch(`/api/reports/${publicCode}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outcome,
        photo: photoDataUrl ? { dataBase64: photoDataUrl, gpsLat: gps?.lat, gpsLng: gps?.lng, gpsAccuracyM: gps?.accuracy } : undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const body = await res.json();
      if (body.check?.mismatchSuspected) {
        setMismatchNote(body.check.explanation);
      } else {
        router.refresh();
      }
    }
  }

  return (
    <div className="rounded-lg border border-neutral-300 px-4 py-3">
      <h3 className="text-sm font-semibold">{t("verification.promptTitle")}</h3>
      <p className="mt-1 text-xs text-neutral-500">{t("verification.promptBody")}</p>

      <label className="mt-3 flex aspect-video items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-sm text-neutral-500">
        {photoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoDataUrl} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : (
          t("capture.takePhoto")
        )}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>

      {mismatchNote && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{mismatchNote}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button disabled={submitting} onClick={() => submit("verified_fixed")} className="btn rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">
          {t("verification.outcomeFixed")}
        </button>
        <button disabled={submitting} onClick={() => submit("partially_fixed")} className="btn rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          {t("verification.outcomePartial")}
        </button>
        <button disabled={submitting} onClick={() => submit("not_fixed_disputed")} className="btn rounded-lg border border-danger px-3 py-2 text-sm text-danger">
          {t("verification.outcomeDisputed")}
        </button>
        <button disabled={submitting} onClick={() => submit("cannot_verify")} className="btn rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          {t("verification.outcomeCannotVerify")}
        </button>
      </div>
    </div>
  );
}
