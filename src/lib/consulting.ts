import { nowIso, rows, uuid, type Db } from "./db";

/** Аналитика для консультанта: только агрегаты за период, без имён, контактов и текстов клиентов. Владелец этот раздел не видит. */
const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };
const n1 = async (db: Db, sql: string, args: (string | number)[]) => safe(async () => Number((await rows<{ n: number | null }>(db, sql, args))[0]?.n ?? 0), 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

export type Signal = { key: string; text: string; evidence: string };
export type Consulting = ReturnType<typeof compute> extends Promise<infer T> ? T : never;

export async function compute(db: Db, tenantId: string, nowMs: number, days = 90) {
  const since = new Date(nowMs - days * 86400000).toISOString();
  const cnt = (status: string) => n1(db, "SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status=?3 AND created_at>=?2", [tenantId, since, status]);
  const created = await n1(db, "SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND created_at>=?2 AND status<>'held'", [tenantId, since]);
  const completed = await cnt("completed"), cancelled = await cnt("cancelled"), noShow = await cnt("no_show"), confirmed = await cnt("confirmed"), requested = await cnt("requested");
  const clientsTotal = await n1(db, "SELECT count(*) n FROM clients WHERE tenant_id=?1", [tenantId, ]);
  const clientsNew = await n1(db, "SELECT count(*) n FROM clients WHERE tenant_id=?1 AND created_at>=?2", [tenantId, since]);
  const returning = await n1(db, "SELECT count(*) n FROM (SELECT client_id FROM appointments WHERE tenant_id=?1 AND status='completed' GROUP BY client_id HAVING count(*)>=2)", [tenantId]);
  const withVisit = await n1(db, "SELECT count(DISTINCT client_id) n FROM appointments WHERE tenant_id=?1 AND status='completed'", [tenantId]);
  const lead = await n1(db, "SELECT CAST(AVG(julianday(start_at)-julianday(created_at)) AS INTEGER) n FROM appointments WHERE tenant_id=?1 AND created_at>=?2 AND status IN ('confirmed','completed')", [tenantId, since]);
  const gap = await n1(db, `SELECT CAST(AVG(d) AS INTEGER) n FROM (SELECT julianday(start_at)-julianday(LAG(start_at) OVER (PARTITION BY client_id ORDER BY start_at)) d FROM appointments WHERE tenant_id=?1 AND status='completed') WHERE d IS NOT NULL`, [tenantId]);
  const sources = await safe(() => rows<{ src: string; n: number }>(db, "SELECT COALESCE(json_extract(source,'$.utm_source'),json_extract(source,'$.channel'),'прямой заход') src, count(*) n FROM appointments WHERE tenant_id=?1 AND created_at>=?2 AND status<>'held' GROUP BY src ORDER BY n DESC LIMIT 6", [tenantId, since]), []);
  const statuses = await safe(() => rows<{ status: string; n: number }>(db, "SELECT status,count(*) n FROM client_state WHERE tenant_id=?1 GROUP BY status", [tenantId]), []);
  const conv = await n1(db, "SELECT count(*) n FROM conversations WHERE tenant_id=?1 AND created_at>=?2", [tenantId, since]);
  const handoffs = await safe(() => rows<{ reason: string; n: number }>(db, "SELECT reason,count(*) n FROM handoffs WHERE tenant_id=?1 AND created_at>=?2 GROUP BY reason ORDER BY n DESC", [tenantId, since]), []);
  const handoffTotal = handoffs.reduce((a, h) => a + h.n, 0);
  const waitlist = await n1(db, "SELECT count(*) n FROM waitlist WHERE tenant_id=?1 AND created_at>=?2", [tenantId, since]);
  const accrued = await n1(db, "SELECT COALESCE(SUM(amount_cents),0) n FROM loyalty_ledger WHERE tenant_id=?1 AND amount_cents>0 AND created_at>=?2", [tenantId, since]);
  const redeemed = await n1(db, "SELECT COALESCE(-SUM(amount_cents),0) n FROM loyalty_ledger WHERE tenant_id=?1 AND kind='redemption' AND created_at>=?2", [tenantId, since]);
  const referrals = await n1(db, "SELECT count(*) n FROM referrals WHERE tenant_id=?1 AND status='rewarded'", [tenantId]);
  const finished = completed + noShow;
  const m = {
    days, created, confirmed, requested, completed, cancelled, noShow,
    cancelPct: pct(cancelled, created), noShowPct: pct(noShow, finished),
    clientsTotal, clientsNew, returning, repeatPct: pct(returning, withVisit), withVisit, leadDays: lead, gapDays: gap,
    sources, statuses, conv, handoffs, handoffTotal, handoffPct: pct(handoffTotal, conv), waitlist, accrued, redeemed, referrals,
  };
  return { ...m, signals: signals(m) };
}

/** Сигналы: правила по числам, а не выводы. Каждый показывает цифры, на которых основан; решать будут консультант и мастер. */
function signals(m: { noShowPct: number | null; noShow: number; completed: number; cancelPct: number | null; created: number; repeatPct: number | null; withVisit: number; handoffPct: number | null; conv: number; statuses: { status: string; n: number }[]; waitlist: number; leadDays: number }): Signal[] {
  const out: Signal[] = [];
  if (m.noShowPct !== null && m.noShow + m.completed >= 10 && m.noShowPct >= 10) out.push({ key: "noshow", text: "Заметная доля неявок: проверить напоминания и условия записи", evidence: `${m.noShowPct}% из ${m.noShow + m.completed} завершённых визитов` });
  if (m.cancelPct !== null && m.created >= 10 && m.cancelPct >= 20) out.push({ key: "cancel", text: "Много отмен: изучить причины и сроки, когда отменяют", evidence: `${m.cancelPct}% из ${m.created} записей` });
  if (m.repeatPct !== null && m.withVisit >= 10 && m.repeatPct < 30) out.push({ key: "repeat", text: "Мало повторных визитов: усилить приглашение на следующий визит", evidence: `вернулись ${m.repeatPct}% из ${m.withVisit} клиентов, бывших на визите` });
  if (m.handoffPct !== null && m.conv >= 10 && m.handoffPct >= 40) out.push({ key: "kb", text: "ИИ часто передаёт вопросы человеку: пополнить утверждённые знания", evidence: `${m.handoffPct}% диалогов из ${m.conv}` });
  const risk = m.statuses.filter((s) => ["overdue", "at_risk", "lost"].includes(s.status)).reduce((a, s) => a + s.n, 0), tot = m.statuses.reduce((a, s) => a + s.n, 0);
  if (tot >= 10 && risk / tot >= 0.3) out.push({ key: "risk", text: "Много клиентов с пропущенным циклом: нужна кампания возврата", evidence: `${risk} из ${tot} клиентов` });
  if (m.waitlist >= 5) out.push({ key: "demand", text: "Растёт лист ожидания: возможно, не хватает окон", evidence: `${m.waitlist} человек за период` });
  if (!out.length) out.push({ key: "none", text: "Явных сигналов нет. Данных пока может быть мало: правила срабатывают от 10 записей или диалогов", evidence: "—" });
  return out;
}

export async function addConsultantNote(db: Db, tenantId: string, body: string): Promise<boolean> {
  const t = body.trim().slice(0, 2000); if (!t) return false;
  try { await db.run("INSERT INTO consultant_notes(id,tenant_id,body,created_at) VALUES (?1,?2,?3,?4)", [uuid(), tenantId, t, nowIso()]); return true; } catch { return false; }
}
export const consultantNotes = (db: Db, tenantId: string) => safe(() => rows<{ id: string; body: string; created_at: string }>(db, "SELECT id,body,created_at FROM consultant_notes WHERE tenant_id=?1 ORDER BY created_at DESC LIMIT 30", [tenantId]), null as { id: string; body: string; created_at: string }[] | null);
