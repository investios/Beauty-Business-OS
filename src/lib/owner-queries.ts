import { rows, type Db } from "@/lib/db";
import { addLocalDays, localParts, zonedToUtc } from "@/lib/tz";

/**
 * Единственное место, где определено, что значит каждый фильтр записей.
 * Плитки обзора и списки считаются ОДНИМ кодом, поэтому цифра всегда равна числу строк.
 */
export const APPT_FILTERS = {
  upcoming: { label: "Предстоящие", def: "подтверждённые и ждущие подтверждения, время начала ещё не наступило" },
  today: { label: "Сегодня", def: "подтверждённые и ждущие подтверждения с началом сегодня (по Дублину)" },
  week: { label: "Ближайшие 7 дней", def: "подтверждённые и ждущие подтверждения, начало в ближайшие 7 суток" },
  new: { label: "Новые за 7 дней", def: "создано за последние 7 суток (не отменённые)" },
  requested: { label: "Ждут подтверждения", def: "статус «заявка», время ещё не наступило" },
  past: { label: "Прошедшие", def: "подтверждённые, состоявшиеся и «не пришёл» с началом в прошлом" },
  cancelled30: { label: "Отменённые с 30 дней", def: "статус «отменена», визит назначен не раньше чем 30 дней назад" },
  cancelled: { label: "Все отменённые", def: "статус «отменена», за всё время" },
  all: { label: "Все", def: "все записи, кроме временных удержаний слота" },
} as const;
export type ApptFilter = keyof typeof APPT_FILTERS;
export const isApptFilter = (f: unknown): f is ApptFilter => typeof f === "string" && f in APPT_FILTERS;

const iso = (ms: number) => new Date(ms).toISOString();

/** WHERE-условие и параметры, нумерация с ?2 (в ?1 всегда tenant). */
export function apptWhere(f: ApptFilter, nowMs: number): { sql: string; args: string[]; order: "ASC" | "DESC" } {
  const day = localParts(nowMs);
  const start = (zonedToUtc(day.y, day.mo, day.d, 0, 0) as { utcMs: number }).utcMs;
  const nx = addLocalDays(day.y, day.mo, day.d, 1);
  const end = (zonedToUtc(nx.y, nx.mo, nx.d, 0, 0) as { utcMs: number }).utcMs;
  const OPEN = "a.status IN ('confirmed','requested')";
  switch (f) {
    case "upcoming": return { sql: `${OPEN} AND a.start_at >= ?2`, args: [iso(nowMs)], order: "ASC" };
    case "today": return { sql: `${OPEN} AND a.start_at >= ?2 AND a.start_at < ?3`, args: [iso(start), iso(end)], order: "ASC" };
    case "week": return { sql: `${OPEN} AND a.start_at >= ?2 AND a.start_at < ?3`, args: [iso(nowMs), iso(nowMs + 7 * 86400000)], order: "ASC" };
    case "new": return { sql: `${OPEN} AND a.created_at >= ?2`, args: [iso(nowMs - 7 * 86400000)], order: "DESC" };
    case "requested": return { sql: `a.status='requested' AND a.start_at >= ?2`, args: [iso(nowMs)], order: "ASC" };
    case "past": return { sql: `a.status IN ('confirmed','completed','no_show') AND a.start_at < ?2`, args: [iso(nowMs)], order: "DESC" };
    case "cancelled30": return { sql: `a.status='cancelled' AND a.start_at >= ?2`, args: [iso(nowMs - 30 * 86400000)], order: "DESC" };
    case "cancelled": return { sql: `a.status='cancelled'`, args: [], order: "DESC" };
    case "all": return { sql: `a.status <> 'held'`, args: [], order: "DESC" };
  }
}

const likeOf = (q: string) => `%${q.replace(/[%_\\]/g, "")}%`;

export async function countAppts(db: Db, tenantId: string, f: ApptFilter, nowMs: number, q = ""): Promise<number> {
  const w = apptWhere(f, nowMs);
  const n = w.args.length + 2;
  const r = await rows<{ n: number }>(db, `SELECT count(*) n FROM appointments a JOIN clients c ON c.id=a.client_id WHERE a.tenant_id=?1 AND ${w.sql} AND (?${n} = '' OR c.name LIKE ?${n + 1} OR c.contact LIKE ?${n + 1})`, [tenantId, ...w.args, q, likeOf(q)]);
  return r[0].n;
}

export type ApptRow = { id: string; start_at: string; status: string; name: string; contact: string; client_id: string; title_i18n: Record<string, string>; source: Record<string, string>; created_at: string };
export async function listAppts(db: Db, tenantId: string, f: ApptFilter, nowMs: number, opts: { q?: string; limit?: number; offset?: number } = {}): Promise<ApptRow[]> {
  const w = apptWhere(f, nowMs);
  const q = opts.q ?? "";
  const n = w.args.length + 2;
  return rows<ApptRow>(db, `SELECT a.id,a.start_at,a.status,a.created_at,c.name,c.contact,c.id client_id,s.title_i18n,a.source FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
    WHERE a.tenant_id=?1 AND ${w.sql} AND (?${n} = '' OR c.name LIKE ?${n + 1} OR c.contact LIKE ?${n + 1}) ORDER BY a.start_at ${w.order} LIMIT ?${n + 2} OFFSET ?${n + 3}`,
    [tenantId, ...w.args, q, likeOf(q), opts.limit ?? 25, opts.offset ?? 0]);
}

/** Человеческие подписи журнала действий. */
export const ACTION_LABEL: Record<string, string> = {
  "booking.create": "Новая запись с сайта", "booking.cancel": "Запись отменена", "booking.reschedule": "Запись перенесена",
  "booking.confirmed": "Запись подтверждена", "booking.completed": "Визит отмечен как состоявшийся", "booking.no_show": "Отмечено: клиент не пришёл",
};
export const actorLabel = (a: string) => (a === "guest" ? "клиент" : a === "owner" ? "вы" : a);

export type Activity = { id: string; actor: string; action: string; target: string | null; at: string };
export async function recentActivity(db: Db, tenantId: string, limit = 10): Promise<Activity[]> {
  return rows<Activity>(db, "SELECT id,actor,action,target,at FROM audit_events WHERE tenant_id=?1 AND action LIKE 'booking.%' ORDER BY at DESC LIMIT ?2", [tenantId, limit]);
}
