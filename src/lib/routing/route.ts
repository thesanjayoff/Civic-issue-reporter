import { db } from "@/lib/db/client";
import { agencyJurisdictions } from "@/lib/db/schema";
import { eq, or, isNull, and } from "drizzle-orm";
import { chooseAgencyRoute, type JurisdictionRule, type RouteContext, type RouteResult } from "./rules";

/** Loads candidate jurisdiction rules and resolves the routing decision for a report. */
export async function routeReport(ctx: RouteContext): Promise<RouteResult> {
  const rows = await db
    .select({
      agencyId: agencyJurisdictions.agencyId,
      categoryId: agencyJurisdictions.categoryId,
      wardId: agencyJurisdictions.wardId,
      zoneId: agencyJurisdictions.zoneId,
      priority: agencyJurisdictions.priority,
    })
    .from(agencyJurisdictions)
    .where(
      and(
        eq(agencyJurisdictions.active, true),
        or(isNull(agencyJurisdictions.categoryId), eq(agencyJurisdictions.categoryId, ctx.categoryId)),
        or(isNull(agencyJurisdictions.wardId), ctx.wardId ? eq(agencyJurisdictions.wardId, ctx.wardId) : isNull(agencyJurisdictions.wardId)),
        or(isNull(agencyJurisdictions.zoneId), ctx.zoneId ? eq(agencyJurisdictions.zoneId, ctx.zoneId) : isNull(agencyJurisdictions.zoneId))
      )
    );

  const rules: JurisdictionRule[] = rows.map((r) => ({
    agencyId: r.agencyId,
    categoryId: r.categoryId,
    wardId: r.wardId,
    zoneId: r.zoneId,
    priority: r.priority,
  }));

  return chooseAgencyRoute(rules, ctx);
}
