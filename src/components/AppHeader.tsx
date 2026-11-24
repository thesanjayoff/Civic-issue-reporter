import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { APP_NAME } from "@/config/app";

export async function AppHeader() {
  const t = await getTranslations();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
      <Link href="/" className="text-lg font-bold text-brand">
        {APP_NAME}
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium text-neutral-700">
        <Link href="/map" className="hidden sm:inline">
          {t("nav.home")}
        </Link>
        <Link href="/report" className="hidden sm:inline">
          {t("nav.report")}
        </Link>
        <Link href="/wards" className="hidden sm:inline">
          {t("nav.wardDashboard")}
        </Link>
        <Link href="/emergency" className="font-semibold text-danger">
          {t("nav.emergency")}
        </Link>
        <LocaleSwitcher />
      </nav>
    </header>
  );
}
