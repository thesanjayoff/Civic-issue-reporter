import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppHeader } from "@/components/AppHeader";
import { peekDeviceId } from "@/lib/auth/session";
import { getReportsForDevice } from "@/lib/reports/mine";

export default async function MyReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const isTa = locale === "ta";

  const deviceId = await peekDeviceId();
  const reports = deviceId ? await getReportsForDevice(deviceId) : [];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl">
          <h1 className="text-xl font-bold">{t("nav.myReports")}</h1>
          {reports.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">
              {isTa ? "இந்த சாதனத்தில் இதுவரை எந்த அறிக்கையும் இல்லை." : "No reports from this device yet."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
              {reports.map((r) => (
                <li key={r.publicCode}>
                  <Link href={`/track/${r.publicCode}`} className="flex items-center justify-between px-4 py-4">
                    <span>
                      <span className="block font-medium">{isTa ? r.categoryNameTa : r.categoryNameEn}</span>
                      <span className="text-xs text-neutral-400">{r.publicCode}</span>
                    </span>
                    <span className="text-xs text-neutral-500">{r.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
