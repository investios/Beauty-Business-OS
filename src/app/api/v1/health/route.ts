import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
export async function GET() {
  try { const db = await getDb(); await db.all("SELECT 1"); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
