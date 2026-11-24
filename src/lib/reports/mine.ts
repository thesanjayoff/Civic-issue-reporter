import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface MyReportSummary {
  publicCode: string;
  status: string;
  categoryNameEn: string;
  categoryNameTa: string;
  createdAt: string;
}

export async function getReportsForDevice(deviceId: string): Promise<MyReportSummary[]> {
  const rows = await db.execute<{ public_code: string; status: string; category_name_en: string; category_name_ta: string; created_at: string }>(sql`
    SELECT r.public_code, r.status, c.name_en AS category_name_en, c.name_ta AS category_name_ta, r.created_at
    FROM reports r
    JOIN categories c ON c.id = r.category_id
    WHERE r.reporter_device_id = ${deviceId} AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC
  `);
  return rows.map((r) => ({
    publicCode: r.public_code,
    status: r.status,
    categoryNameEn: r.category_name_en,
    categoryNameTa: r.category_name_ta,
    createdAt: r.created_at,
  }));
}
