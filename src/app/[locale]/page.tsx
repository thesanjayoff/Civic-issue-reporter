import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { APP_NAME } from "@/config/app";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-4 py-3">
        <span className="text-lg font-bold text-brand">{APP_NAME}</span>
        <LocaleSwitcher />
      </header>

      <main className="flex-1 px-4 py-8">
        <section className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-bold leading-snug text-neutral-900">{t("home.heroTitle")}</h1>
          <p className="mt-3 text-base text-neutral-600">{t("home.heroSubtitle")}</p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/report"
              className="btn flex items-center justify-center rounded-xl bg-brand px-6 py-4 text-lg font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              {t("home.startReport")}
            </Link>
            <Link
              href="/map"
              className="btn flex items-center justify-center rounded-xl border-2 border-brand px-6 py-4 text-lg font-semibold text-brand"
            >
              {t("home.viewMap")}
            </Link>
          </div>

          <p className="mt-10 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("home.disclaimer")}</p>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white px-4 py-4 text-center text-xs text-neutral-500">
        {t("footer.notGovernment")}
      </footer>
    </div>
  );
}
