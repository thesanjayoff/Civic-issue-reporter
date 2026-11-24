import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/catalog/categories";

export async function GET() {
  return NextResponse.json({ categories: CATEGORIES });
}
