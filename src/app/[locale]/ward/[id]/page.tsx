import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getWardDashboard } from "@/lib/wards/dashboard";

function fmtHours(h: number | null): string {
  if (h === null) return "—";
  return h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`;
}

function fmtPct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default async function WardDashboardPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const dashboard = await getWardDashboard(id);
  if (!dashboard) notFound();

  const isTa = locale === "ta";
  const wardName = isTa ? dashboard.wardNameTa : dashboard.wardNameEn;

  const stats: { label: string; value: string }[] = [
    { label: t("wardDashboard.reportsPer1000"), value: dashboard.reportsPer1000Residents !== null ? dashboard.reportsPer1000Residents.toFixed(2) : "—" },
    { label: t("wardDashboard.medianAcknowledgment"), value: fmtHours(dashboard.medianAckHours) },
    { label: t("wardDashboard.medianResolution"), value: fmtHours(dashboard.medianResolutionHours) },
    { label: t("wardDashboard.shareOverdue"), value: fmtPct(dashboard.overdueShare) },
    { label: t("wardDashboard.reopenRate"), value: fmtPct(dashboard.reopenRate) },
    { label: t("wardDashboard.falseClosureRate"), value: fmtPct(dashboard.falseClosureRate) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl">
          <h1 className="text-xl font-bold">{t("wardDashboard.title", { ward: wardName })}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t("wardDashboard.methodologyNote")}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-neutral-300 px-4 py-3">
                <p className="text-2xl font-bold text-brand">{s.value}</p>
                <p className="mt-1 text-xs text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-neutral-600">
            {dashboard.totalReports} total reports, {dashboard.openReports} currently open.
          </p>

          <details className="mt-6 rounded-lg bg-neutral-100 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">{t("wardDashboard.methodologyTitle")}</summary>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-700">
              {dashboard.methodologyNotes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </details>
        </div>
      </main>
    </div>
  );
}
