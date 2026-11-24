import { getTranslations, setRequestLocale } from "next-intl/server";

// Reads live category data from the DB on every request — must not be
// statically prerendered at build time (a new category added after a build
// would otherwise silently never appear in the map's filter dropdown).
export const dynamic = "force-dynamic";
import { AppHeader } from "@/components/AppHeader";
import { ReportsMap } from "@/components/map/ReportsMap";
import { CATEGORIES } from "@/lib/catalog/categories";
import { db } from "@/lib/db/client";
import { categories } from "@/lib/db/schema";

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const categoryRows = await db.select({ id: categories.id, slug: categories.slug }).from(categories);
  const categoryIdBySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c.id]));

  const statusLabels: Record<string, string> = {
    open: t("timeline.reported"),
    filed: t("timeline.filed"),
    acknowledged: t("timeline.acknowledged"),
    in_progress: t("timeline.work_started"),
    resolved_by_authority: t("timeline.resolved_by_authority"),
    verified_fixed: t("timeline.citizen_verified_fixed"),
    disputed: t("timeline.citizen_disputed"),
    reopened: t("timeline.reopened"),
    escalated: t("timeline.escalated"),
    closed: t("timeline.closed"),
  };

  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <ReportsMap
        categories={CATEGORIES.filter((c) => !c.isEmergency)}
        categoryIdBySlug={categoryIdBySlug}
        statusLabels={statusLabels}
        categoryLabel={t("map.category")}
        statusLabelText={t("map.status")}
        overdueOnlyLabel={t("map.overdueOnly")}
        heatmapLabel={t("map.heatmap")}
        allLabel={locale === "ta" ? "அனைத்தும்" : "All"}
        locale={locale}
      />
    </div>
  );
}
