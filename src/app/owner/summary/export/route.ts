import { NextResponse } from "next/server";
import { ownerTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { masterSummary, summaryCsv } from "@/lib/master-summary";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const t = await ownerTenant();
  if (!t) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const days = [30, 90, 365].includes(Number(new URL(req.url).searchParams.get("days"))) ? Number(new URL(req.url).searchParams.get("days")) : 90;
  const csv = summaryCsv(await masterSummary(await getDb(), t.id, Date.now(), days));
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="itogi-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
