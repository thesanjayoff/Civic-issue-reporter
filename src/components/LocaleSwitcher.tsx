"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useParams } from "next/navigation";

const LOCALE_LABELS: Record<string, string> = { en: "English", ta: "தமிழ்" };

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        className="min-h-[44px] rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
        value={locale}
        onChange={(e) => {
          const nextLocale = e.target.value as (typeof routing.locales)[number];
          router.replace(
            // @ts-expect-error -- pathname is dynamic across routes; navigation typing is stricter than this generic switcher needs
            { pathname, params },
            { locale: nextLocale }
          );
        }}
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l] ?? l}
          </option>
        ))}
      </select>
    </label>
  );
}
