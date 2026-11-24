import { NextResponse } from "next/server";
import { getReportByPublicCode, getTimelineForReport, getPhotosForReport, getVerificationAttemptsForReport } from "@/lib/reports/detail";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const report = await getReportByPublicCode(code);
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [timeline, photos, verifications] = await Promise.all([
    getTimelineForReport(report.id),
    getPhotosForReport(report.id),
    getVerificationAttemptsForReport(report.id),
  ]);

  return NextResponse.json({ report, timeline, photos, verifications });
}
