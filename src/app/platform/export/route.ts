import { NextResponse } from "next/server";
import { platformAuthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { conversationsCsv, fullReport, logAccess, transcripts } from "@/lib/platform";

export const dynamic = "force-dynamic";
/** Выгрузка для анализа: ?t=<салон>&kind=report|conversations&days=90. Только после входа владельца платформы; каждая выгрузка пишется в журнал. */
export async function GET(req: Request) {
  if (!(await platformAuthorized())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const u = new URL(req.url);
  const t = u.searchParams.get("t") ?? "";
  const kind = u.searchParams.get("kind") === "conversations" ? "conversations" : "report";
  const days = Math.min(365, Math.max(1, Number(u.searchParams.get("days")) || 90));
  const db = await getDb();
  const rep = await fullReport(db, t, days);
  if (!rep) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  await logAccess(db, t, "platform.export", `${kind}:${days}d`);
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "conversations") {
    const csv = conversationsCsv(await transcripts(db, t, days, 1000));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${rep.tenant.slug}-conversations-${stamp}.csv"`, "Cache-Control": "no-store" } });
  }
  return new NextResponse(JSON.stringify(rep, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${rep.tenant.slug}-full-report-${stamp}.json"`, "Cache-Control": "no-store" } });
}
