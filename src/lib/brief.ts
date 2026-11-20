import { nowIso, rows, type Db } from "./db";
import { addLocalDays, formatLocal, localParts, zonedToUtc } from "./tz";

export type Brief = {
  day: string; label: string;
  visits: { time: string; name: string; service: string; first: boolean; notes: string[] }[];
  open: { questions: number; complaints: number; waitlist: number; requested: number; atRisk: number };
};
const z2 = (n: number) => String(n).padStart(2, "0");
const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };

/** Сводка на завтра: кто придёт, первый ли визит, что важно знать (заметки «пожелания», «технические», «здоровье»), и что ждёт решения мастера. */
export async function buildBrief(db: Db, tenantId: string, nowMs: number): Promise<Brief> {
  const p = localParts(nowMs), t = addLocalDays(p.y, p.mo, p.d, 1);
  const a = zonedToUtc(t.y, t.mo, t.d, 0, 0), b = zonedToUtc(t.y, t.mo, t.d + 1, 0, 0);
  const from = a.status === "ok" ? a.utcMs : nowMs, to = b.status === "ok" ? b.utcMs : from + 86400000;
  const appts = await rows<{ id: string; start_at: string; name: string; client_id: string; title_i18n: Record<string, string> }>(db,
    "SELECT a.id,a.start_at,c.name,c.id client_id,s.title_i18n FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id WHERE a.tenant_id=?1 AND a.status='confirmed' AND a.start_at>=?2 AND a.start_at<?3 ORDER BY a.start_at",
    [tenantId, new Date(from).toISOString(), new Date(to).toISOString()]);
  const visits: Brief["visits"] = [];
  for (const x of appts) {
    const before = await rows<{ n: number }>(db, "SELECT count(*) n FROM appointments WHERE client_id=?1 AND tenant_id=?2 AND status='completed' AND start_at<?3", [x.client_id, tenantId, x.start_at]);
    const notes = await safe(() => rows<{ category: string; body: string }>(db, "SELECT category,body FROM client_notes WHERE client_id=?1 AND tenant_id=?2 AND category IN ('preference','technical','health') ORDER BY created_at DESC LIMIT 3", [x.client_id, tenantId]), []);
    visits.push({ time: formatLocal(new Date(x.start_at).getTime(), "ru").split(",").pop()!.trim(), name: x.name, service: x.title_i18n.ru, first: before[0].n === 0, notes: notes.map((n) => n.body.slice(0, 160)) });
  }
  const n = async (sql: string) => safe(async () => (await rows<{ n: number }>(db, sql, [tenantId]))[0].n, 0);
  return {
    day: `${t.y}-${z2(t.mo)}-${z2(t.d)}`,
    label: new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long" }).format(new Date(from + 12 * 3600000)),
    visits,
    open: {
      questions: await n("SELECT count(*) n FROM handoffs WHERE tenant_id=?1 AND status='open'"),
      complaints: await n("SELECT count(*) n FROM complaints WHERE tenant_id=?1 AND status='open'"),
      waitlist: await n("SELECT count(*) n FROM waitlist WHERE tenant_id=?1 AND status IN ('waiting','offered')"),
      requested: await n("SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status='requested'"),
      atRisk: await n("SELECT count(*) n FROM client_state WHERE tenant_id=?1 AND status IN ('at_risk','overdue')"),
    },
  };
}
export async function saveBrief(db: Db, tenantId: string, b: Brief) {
  await db.run("INSERT INTO daily_briefs(tenant_id,day,body,created_at) VALUES (?1,?2,?3,?4) ON CONFLICT(tenant_id,day) DO UPDATE SET body=?3, created_at=?4", [tenantId, b.day, JSON.stringify(b), nowIso()]);
}
