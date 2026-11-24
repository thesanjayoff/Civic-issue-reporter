"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LocationPicker } from "@/components/map/LocationPicker";
import { suggestCategory } from "@/lib/classify/heuristic";
import { queueReport } from "@/lib/offline/queue";
import type { CategoryDef } from "@/lib/catalog/categories";
import type { CreateReportInput } from "@/lib/reports/create";

interface BlurBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PhotoDraft {
  dataUrl: string;
  blurBoxes: BlurBox[];
}

interface DuplicateCandidate {
  reportId: string;
  publicCode: string;
  score: number;
}

const STEPS = ["stepPhoto", "stepLocation", "stepCategory", "stepDetails", "stepReview"] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReportWizard({ categories }: { categories: CategoryDef[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [stepIndex, setStepIndex] = useState(0);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [activeBlurPhoto, setActiveBlurPhoto] = useState<number | null>(null);

  const [lon, setLon] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [locationAccuracyM, setLocationAccuracyM] = useState<number | undefined>(undefined);
  const [landmarkText, setLandmarkText] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [categorySource, setCategorySource] = useState<"manual" | "heuristic">("manual");

  const [descriptionEn, setDescriptionEn] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "error" | "offline-queued">("idle");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);

  const reportableCategories = useMemo(() => categories.filter((c) => !c.isEmergency), [categories]);
  const suggestion = useMemo(() => suggestCategory(descriptionEn, reportableCategories), [descriptionEn, reportableCategories]);

  useEffect(() => {
    if (suggestion && !categorySlug) {
      setCategorySlug(suggestion.slug);
      setCategorySource("heuristic");
    }
  }, [suggestion, categorySlug]);

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not available on this device/browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLon(pos.coords.longitude);
        setLat(pos.coords.latitude);
        setLocationAccuracyM(pos.coords.accuracy);
      },
      () => setGeoError("Couldn't get your location — tap the map to set it manually."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function onPhotoFiles(files: FileList | null) {
    if (!files) return;
    const remaining = 4 - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    const dataUrls = await Promise.all(selected.map(readFileAsDataUrl));
    setPhotos((prev) => [...prev, ...dataUrls.map((dataUrl) => ({ dataUrl, blurBoxes: [] }))]);
  }

  function addBlurBoxAt(photoIndex: number, e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const box: BlurBox = { x: Math.max(0, x - 0.1), y: Math.max(0, y - 0.1), width: 0.2, height: 0.2 };
    setPhotos((prev) => prev.map((p, i) => (i === photoIndex ? { ...p, blurBoxes: [...p.blurBoxes, box] } : p)));
  }

  function undoLastBlur(photoIndex: number) {
    setPhotos((prev) => prev.map((p, i) => (i === photoIndex ? { ...p, blurBoxes: p.blurBoxes.slice(0, -1) } : p)));
  }

  function toggleVoiceInput() {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: typeof SpeechRecognitionLikeCtor; webkitSpeechRecognition?: typeof SpeechRecognitionLikeCtor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognitionLikeCtor }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = locale === "ta" ? "ta-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ");
      setDescriptionEn((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }

  function buildPayload(confirmDespiteDuplicates: boolean): CreateReportInput {
    return {
      categorySlug: categorySlug!,
      categoryConfidence: categorySource === "heuristic" ? suggestion?.confidence : undefined,
      categorySource,
      descriptionEn: descriptionEn || undefined,
      lon: lon!,
      lat: lat!,
      locationAccuracyM,
      landmarkText: landmarkText || undefined,
      isSensitive,
      photos: photos.map((p) => ({ dataBase64: p.dataUrl, blurBoxes: p.blurBoxes.length > 0 ? p.blurBoxes : undefined })),
      confirmDespiteDuplicates,
    };
  }

  async function submit(confirmDespiteDuplicates = false) {
    setSubmitState("submitting");
    setDuplicates(null);
    const payload = buildPayload(confirmDespiteDuplicates);

    if (!navigator.onLine) {
      await queueReport(payload);
      setSubmitState("offline-queued");
      return;
    }

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        const body = await res.json();
        setDuplicates(body.candidates ?? []);
        setSubmitState("idle");
        return;
      }
      if (!res.ok) {
        setSubmitState("error");
        return;
      }
      const body = await res.json();
      router.push(`/track/${body.publicCode}`);
    } catch {
      await queueReport(payload);
      setSubmitState("offline-queued");
    }
  }

  async function addVoiceToExisting(publicCode: string) {
    await fetch(`/api/reports/${publicCode}/supporters`, { method: "POST" });
    router.push(`/track/${publicCode}`);
  }

  const canGoNext =
    (stepIndex === 0 && photos.length > 0) ||
    (stepIndex === 1 && lon !== null && lat !== null) ||
    (stepIndex === 2 && categorySlug !== null) ||
    stepIndex === 3;

  if (submitState === "offline-queued") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="rounded-lg bg-amber-50 px-4 py-4 text-amber-900">{t("capture.offlineQueued")}</p>
        <button onClick={() => router.push("/")} className="btn mt-6 rounded-xl bg-brand px-6 py-3 font-semibold text-white">
          {t("common.close")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col px-4 py-4">
      <ol className="mb-4 flex gap-1" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIndex ? "bg-brand" : "bg-neutral-200"}`} />
        ))}
      </ol>

      {stepIndex === 0 && (
        <section>
          <h2 className="text-lg font-semibold">{t("capture.stepPhoto")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative">
                <div
                  className="relative aspect-square cursor-crosshair overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100"
                  onClick={(e) => (activeBlurPhoto === i ? addBlurBoxAt(i, e) : undefined)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt="" className="h-full w-full object-cover" />
                  {p.blurBoxes.map((b, bi) => (
                    <div
                      key={bi}
                      className="absolute border-2 border-red-500 bg-neutral-900/70"
                      style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.width * 100}%`, height: `${b.height * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <button type="button" onClick={() => setActiveBlurPhoto(activeBlurPhoto === i ? null : i)} className="min-h-0 text-brand underline">
                    {activeBlurPhoto === i ? t("common.close") : t("capture.blurFaces")}
                  </button>
                  <div className="flex gap-2">
                    {p.blurBoxes.length > 0 && (
                      <button type="button" onClick={() => undoLastBlur(i)} className="min-h-0 text-neutral-500 underline">
                        {t("common.back")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, pi) => pi !== i))}
                      className="min-h-0 text-danger underline"
                    >
                      {t("capture.removePhoto")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {photos.length < 4 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-300 text-sm text-neutral-500">
                {t("capture.takePhoto")}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhotoFiles(e.target.files)} />
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t("capture.blurHint")}</p>
        </section>
      )}

      {stepIndex === 1 && (
        <section>
          <h2 className="text-lg font-semibold">{t("capture.locationTitle")}</h2>
          <button type="button" onClick={useMyLocation} className="btn mt-3 w-full rounded-xl border-2 border-brand px-4 py-3 font-semibold text-brand">
            {t("capture.locationUseGps")}
          </button>
          {geoError && <p className="mt-2 text-sm text-danger">{geoError}</p>}
          <div className="mt-3">
            <LocationPicker lon={lon} lat={lat} onChange={(nLon, nLat) => { setLon(nLon); setLat(nLat); }} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">{t("capture.locationDrag")}</p>
          <input
            type="text"
            value={landmarkText}
            onChange={(e) => setLandmarkText(e.target.value)}
            placeholder={t("capture.locationSearch")}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-3"
          />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isSensitive} onChange={(e) => setIsSensitive(e.target.checked)} />
            {t("capture.sensitiveLocation")}
          </label>
        </section>
      )}

      {stepIndex === 2 && (
        <section>
          <h2 className="text-lg font-semibold">{t("capture.categoryTitle")}</h2>
          {suggestion && (
            <p className="mt-2 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
              {t("capture.categorySuggested")}: {reportableCategories.find((c) => c.slug === suggestion.slug)?.[locale === "ta" ? "nameTa" : "nameEn"]} —{" "}
              {t("capture.categoryConfidence", { percent: Math.round(suggestion.confidence * 100) })}
              <br />
              <span className="text-xs text-brand/80">{t("capture.categoryEditHint")}</span>
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {reportableCategories
              .filter((c) => c.parentSlug !== null)
              .map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => {
                    setCategorySlug(c.slug);
                    setCategorySource("manual");
                  }}
                  className={`btn rounded-lg border-2 px-3 py-3 text-sm font-medium ${
                    categorySlug === c.slug ? "border-brand bg-brand/10 text-brand" : "border-neutral-300 text-neutral-700"
                  }`}
                >
                  {locale === "ta" ? c.nameTa : c.nameEn}
                </button>
              ))}
          </div>
        </section>
      )}

      {stepIndex === 3 && (
        <section>
          <h2 className="text-lg font-semibold">{t("capture.descriptionTitle")}</h2>
          <textarea
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            placeholder={t("capture.descriptionPlaceholder")}
            rows={5}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-3"
          />
          <button type="button" onClick={toggleVoiceInput} className="btn mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm">
            {isRecording ? t("capture.voiceRecording") : t("capture.voiceInput")}
          </button>
        </section>
      )}

      {stepIndex === 4 && (
        <section>
          <h2 className="text-lg font-semibold">{t("capture.stepReview")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="font-medium text-neutral-500">{t("capture.categoryTitle")}</dt>
              <dd>{reportableCategories.find((c) => c.slug === categorySlug)?.[locale === "ta" ? "nameTa" : "nameEn"]}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">{t("capture.locationTitle")}</dt>
              <dd>{landmarkText || `${lat?.toFixed(5)}, ${lon?.toFixed(5)}`}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">{t("capture.descriptionTitle")}</dt>
              <dd>{descriptionEn || "—"}</dd>
            </div>
          </dl>

          {duplicates && duplicates.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-medium text-amber-900">{t("capture.nearbyReportsTitle")}</p>
              <ul className="mt-2 space-y-2">
                {duplicates.map((d) => (
                  <li key={d.reportId} className="flex items-center justify-between text-sm">
                    <span>{d.publicCode}</span>
                    <button type="button" onClick={() => addVoiceToExisting(d.publicCode)} className="min-h-0 font-semibold text-brand underline">
                      {t("capture.addYourVoice")}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => submit(true)} className="btn mt-3 w-full rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-900">
                {t("common.submit")} ({t("capture.confirmAnyway")})
              </button>
            </div>
          )}

          {submitState === "error" && <p className="mt-3 text-sm text-danger">{t("capture.submitError")}</p>}

          {!duplicates && (
            <button type="button" disabled={submitState === "submitting"} onClick={() => submit(false)} className="btn mt-6 w-full rounded-xl bg-brand px-6 py-4 text-lg font-semibold text-white disabled:opacity-60">
              {t("common.submit")}
            </button>
          )}
        </section>
      )}

      <div className="mt-auto flex gap-3 pt-6">
        {stepIndex > 0 && (
          <button type="button" onClick={() => setStepIndex((i) => i - 1)} className="btn flex-1 rounded-xl border-2 border-neutral-300 px-4 py-3 font-semibold text-neutral-700">
            {t("common.back")}
          </button>
        )}
        {stepIndex < STEPS.length - 1 && (
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => setStepIndex((i) => i + 1)}
            className="btn flex-1 rounded-xl bg-brand px-4 py-3 font-semibold text-white disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        )}
      </div>
    </div>
  );
}

// Minimal structural type for the non-standard SpeechRecognition API (not in lib.dom.d.ts).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEventLike) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
declare const SpeechRecognitionLikeCtor: { new (): SpeechRecognitionLike };
