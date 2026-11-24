import { NextResponse } from "next/server";
import { getWardDashboard } from "@/lib/wards/dashboard";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dashboard = await getWardDashboard(id);
  if (!dashboard) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(dashboard);
}
