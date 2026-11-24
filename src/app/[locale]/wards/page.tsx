import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppHeader } from "@/components/AppHeader";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Reads the live wards table — must not be statically prerendered (a ward
// added after a build would otherwise never show up without a rebuild).
export const dynamic = "force-dynamic";

export default async function WardsListPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const isTa = locale === "ta";

  const wards = await db.execute<{ id: string; name_en: string; name_ta: string; ward_number: number }>(
    sql`SELECT id, name_en, name_ta, ward_number FROM wards ORDER BY ward_number ASC`
  );

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl">
          <h1 className="text-xl font-bold">{t("nav.wardDashboard")}</h1>
          <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {wards.map((w) => (
              <li key={w.id}>
                <Link href={`/ward/${w.id}`} className="flex items-center justify-between px-4 py-4">
                  <span>{isTa ? w.name_ta : w.name_en}</span>
                  <span className="text-neutral-400">#{w.ward_number}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
