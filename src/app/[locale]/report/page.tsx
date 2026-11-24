import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { Link } from "@/i18n/navigation";
import { ReportWizard } from "@/components/report/ReportWizard";
import { CATEGORIES } from "@/lib/catalog/categories";

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <Link href="/emergency" className="mx-auto mt-3 w-full max-w-md rounded-lg bg-red-50 px-4 py-2 text-center text-sm font-medium text-danger">
        {t("emergency.title")} →
      </Link>
      <ReportWizard categories={CATEGORIES} />
    </div>
  );
}
