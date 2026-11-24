import { setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { ReportWizard } from "@/components/report/ReportWizard";
import { CATEGORIES } from "@/lib/catalog/categories";

export default async function ReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <ReportWizard categories={CATEGORIES} />
    </div>
  );
}
