import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { CONTACTS, verifiedContacts } from "@/lib/catalog/contacts";
import { CATEGORIES } from "@/lib/catalog/categories";

export default async function EmergencyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const isTa = locale === "ta";

  const verified = verifiedContacts().filter((c) => c.kind === "phone");
  const unverified = CONTACTS.filter((c) => c.verificationStatus === "unverified" && c.kind === "phone");
  const emergencyCategories = CATEGORIES.filter((c) => c.isEmergency);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border-2 border-danger bg-red-50 px-4 py-4">
            <h1 className="text-xl font-bold text-danger">{t("emergency.title")}</h1>
            <p className="mt-2 text-sm text-red-900">{t("emergency.body")}</p>
          </div>

          <ul className="mt-6 flex flex-col gap-3" aria-label={t("emergency.title")}>
            {verified.map((c) => (
              <li key={c.key}>
                <a
                  href={`tel:${c.value}`}
                  className="btn flex items-center justify-between rounded-xl bg-danger px-5 py-4 text-lg font-semibold text-white shadow-sm active:scale-[0.99]"
                >
                  <span>{isTa ? c.labelTa : c.labelEn}</span>
                  <span className="text-2xl font-bold">{c.value}</span>
                </a>
                <p className="mt-1 text-xs text-neutral-500">{t("emergency.verifiedNote", { date: c.sourceDate })}</p>
              </li>
            ))}
          </ul>

          {unverified.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-neutral-700">{t("common.unverified")}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {unverified.map((c) => (
                  <li key={c.key} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                    <a href={c.value ? `tel:${c.value}` : undefined} className="font-medium text-neutral-900">
                      {isTa ? c.labelTa : c.labelEn} {c.value && <span className="font-bold">— {c.value}</span>}
                    </a>
                    <p className="mt-1 text-xs text-amber-800">{t("emergency.unverifiedNote")}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 rounded-lg bg-neutral-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-700">
              {isTa ? "அவசரநிலையாகக் கருதப்படும் பிரச்சனைகள்" : "Issues treated as emergencies"}
            </h2>
            <ul className="mt-2 list-inside list-disc text-sm text-neutral-700">
              {emergencyCategories.map((c) => (
                <li key={c.slug}>{isTa ? c.nameTa : c.nameEn}</li>
              ))}
            </ul>
          </div>

          <a href="/report" className="btn mt-8 flex items-center justify-center rounded-xl border-2 border-neutral-300 px-5 py-4 font-medium text-neutral-700">
            {t("emergency.continueToReport")}
          </a>
        </div>
      </main>
    </div>
  );
}
