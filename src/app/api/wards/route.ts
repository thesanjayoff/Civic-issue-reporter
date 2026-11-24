import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export async function GET() {
  const rows = await db.execute<{ id: string; ward_number: number; name_en: string; name_ta: string; zone_id: string | null }>(sql`
    SELECT id, ward_number, name_en, name_ta, zone_id FROM wards ORDER BY ward_number ASC
  `);
  return NextResponse.json({
    wards: rows.map((r) => ({ id: r.id, wardNumber: r.ward_number, nameEn: r.name_en, nameTa: r.name_ta, zoneId: r.zone_id })),
  });
}
