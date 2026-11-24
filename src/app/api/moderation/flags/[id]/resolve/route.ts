import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/log";

const resolveSchema = z.object({
  status: z.enum(["upheld", "dismissed"]),
  resolutionNotes: z.string().max(1000).optional(),
});

/** No auth gate yet — intended for a moderator-only area; see README limitations. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = resolveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });

  const rows = await db.execute<{ report_id: string | null }>(sql`
    UPDATE moderation_flags SET status = ${parsed.data.status}, resolution_notes = ${parsed.data.resolutionNotes ?? null}, resolved_at = now()
    WHERE id = ${id} RETURNING report_id
  `);
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await appendAudit({
    actorType: "moderator",
    action: "moderation_flag_resolved",
    entityType: "moderation_flag",
    entityId: id,
    payload: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true });
}
