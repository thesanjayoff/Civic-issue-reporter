import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SupportButton } from "@/components/report/SupportButton";
import { FileReportForm } from "@/components/report/FileReportForm";
import { VerifyClosureForm } from "@/components/report/VerifyClosureForm";
import { EscalatePanel } from "@/components/report/EscalatePanel";
import { FlagButton } from "@/components/report/FlagButton";
import { getReportByPublicCode, getTimelineForReport, getPhotosForReport } from "@/lib/reports/detail";

export default async function TrackPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const report = await getReportByPublicCode(code);
  if (!report) notFound();

  const [timeline, photos] = await Promise.all([getTimelineForReport(report.id), getPhotosForReport(report.id)]);

  const isTa = locale === "ta";
  const now = Date.now();
  const deadline = report.slaDeadline ? new Date(report.slaDeadline) : null;
  const overdue = deadline ? deadline.getTime() < now : false;
  const hoursRemaining = deadline ? (deadline.getTime() - now) / 3_600_000 : null;

  const canFile = !report.officialReferenceNumber && report.agencyNameEn;
  const canVerify = report.status === "resolved_by_authority";
  const canEscalate = overdue || report.status === "reopened" || report.status === "escalated";

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl space-y-5">
          <div>
            <p className="text-xs font-mono text-neutral-400">{report.publicCode}</p>
            <h1 className="text-xl font-bold">{isTa ? report.categoryNameTa : report.categoryNameEn}</h1>
            <p className="mt-1 text-sm text-neutral-600">{report.landmarkText ?? (isTa ? report.wardNameTa : report.wardNameEn) ?? "—"}</p>
            {report.descriptionEn && <p className="mt-2 text-sm text-neutral-700">{report.descriptionEn}</p>}
          </div>

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.storageKey} alt="" className="h-28 w-28 rounded-lg object-cover" />
              ))}
            </div>
          )}

          <div className="rounded-lg border border-neutral-300 px-4 py-3">
            <h2 className="text-sm font-semibold">{t("routing.title")}</h2>
            <p className="mt-1 text-sm">
              {report.agencyNameEn ? (isTa ? report.agencyNameTa : report.agencyNameEn) : t("common.ownerUnknown")}
              {report.routingConfidence !== null && report.routingConfidence < 0.6 && (
                <span className="ml-2 text-xs text-amber-700">({t("routing.confidenceLow")})</span>
              )}
            </p>
          </div>

          {deadline && (
            <div className={`rounded-lg border px-4 py-3 ${overdue ? "border-danger bg-red-50" : "border-neutral-300"}`}>
              <h2 className="text-sm font-semibold">{t("sla.title")}</h2>
              <p className="mt-1 text-sm">{t("sla.deadline", { date: deadline.toLocaleDateString(isTa ? "ta-IN" : "en-IN") })}</p>
              <p className={`mt-1 text-sm ${overdue ? "font-semibold text-danger" : ""}`}>
                {overdue
                  ? t("sla.overdue", { hours: Math.round(Math.abs(hoursRemaining ?? 0)) })
                  : t("sla.remaining", { hours: Math.round(hoursRemaining ?? 0) })}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{t("common.estimatedNotGuaranteed")}</p>
            </div>
          )}

          {canFile && <FileReportForm publicCode={report.publicCode} agencyName={(isTa ? report.agencyNameTa : report.agencyNameEn) ?? ""} />}

          <div className="flex items-center justify-between">
            <SupportButton publicCode={report.publicCode} initialCount={report.supporterCount} />
            <FlagButton publicCode={report.publicCode} />
          </div>

          {canVerify && <VerifyClosureForm publicCode={report.publicCode} />}
          {canEscalate && <EscalatePanel publicCode={report.publicCode} />}

          <div>
            <h2 className="text-sm font-semibold">{t("timeline.title")}</h2>
            <ol className="mt-2 space-y-2 border-l-2 border-neutral-200 pl-4">
              {timeline.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <p className="text-sm font-medium">{t(`timeline.${ev.type}` as never)}</p>
                  <p className="text-xs text-neutral-500">{new Date(ev.createdAt).toLocaleString(isTa ? "ta-IN" : "en-IN")}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
