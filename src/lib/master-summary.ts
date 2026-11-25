import { rows, type Db } from "./db";

/** Итоговые цифры для мастера: общие числа о бизнесе за период. Без текстов диалогов, сигналов консультанта и внутренних расчётов. */
const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };
const n1 = (db: Db, sql: string, a: (string | number)[]) => safe(async () => Number((await rows<{ n: number | null }>(db, sql, a))[0]?.n ?? 0), 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const ru = (j: string) => { try { return (JSON.parse(j) as Record<string, string>).ru ?? j; } catch { return j; } };

export async function masterSummary(db: Db, tenantId: string, nowMs: number, days: number) {
  const since = new Date(nowMs - days * 86400000).toISOString();
  const before = new Date(nowMs - 2 * days * 86400000).toISOString();
  const appt = (st: string) => n1(db, "SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status=?3 AND start_at>=?2 AND start_at<?4", [tenantId, since, st, new Date(nowMs).toISOString()]);
  const clientsTotal = await n1(db, "SELECT count(*) n FROM clients WHERE tenant_id=?1", [tenantId]);
  const clientsNew = await n1(db, "SELECT count(*) n FROM clients WHERE tenant_id=?1 AND created_at>=?2", [tenantId, since]);
  const clientsPrev = await n1(db, "SELECT count(*) n FROM clients WHERE tenant_id=?1 AND created_at>=?2 AND created_at<?3", [tenantId, before, since]);
  const completed = await appt("completed"), cancelled = await appt("cancelled"), noShow = await appt("no_show");
  const returning = await n1(db, "SELECT count(*) n FROM (SELECT client_id FROM appointments WHERE tenant_id=?1 AND status='completed' GROUP BY client_id HAVING count(*)>1)", [tenantId]);
  const withVisit = await n1(db, "SELECT count(DISTINCT client_id) n FROM appointments WHERE tenant_id=?1 AND status='completed'", [tenantId]);
  const upcoming = await n1(db, "SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status='confirmed' AND start_at>=?2", [tenantId, new Date(nowMs).toISOString()]);
  const services = (await safe(() => rows<{ title: string; n: number }>(db,
    "SELECT s.title_i18n title, count(*) n FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.tenant_id=?1 AND a.status='completed' AND a.start_at>=?2 GROUP BY s.id ORDER BY n DESC LIMIT 10", [tenantId, since]), [])).map((s) => ({ title: ru(s.title), n: s.n }));
  const months = (await safe(() => rows<{ m: string; n: number }>(db,
    "SELECT substr(created_at,1,7) m, count(*) n FROM clients WHERE tenant_id=?1 GROUP BY 1 ORDER BY 1 DESC LIMIT 6", [tenantId]), [])).reverse();
  const growthPct = clientsPrev > 0 ? Math.round(((clientsNew - clientsPrev) / clientsPrev) * 100) : null;
  return { days, clientsTotal, clientsNew, clientsPrev, growthPct, completed, cancelled, noShow, upcoming, returning, withVisit, repeatPct: pct(returning, withVisit), services, months };
}

export function summaryCsv(s: Awaited<ReturnType<typeof masterSummary>>): string {
  const L: [string, string | number][] = [
    ["Период, дней", s.days], ["Клиентов всего", s.clientsTotal], ["Новых клиентов за период", s.clientsNew], ["Новых клиентов за прошлый такой же период", s.clientsPrev],
    ["Рост новых клиентов, %", s.growthPct ?? ""], ["Состоялось визитов", s.completed], ["Отменено", s.cancelled], ["Не пришли", s.noShow], ["Предстоящих записей", s.upcoming],
    ["Клиентов вернулись повторно", s.returning], ["Доля вернувшихся, %", s.repeatPct ?? ""],
  ];
  const out = ["Показатель;Значение", ...L.map(([k, v]) => `${k};${v}`), "", "Услуга;Состоявшихся визитов", ...s.services.map((x) => `${x.title.replace(/;/g, ",")};${x.n}`), "", "Месяц;Новых клиентов", ...s.months.map((m) => `${m.m};${m.n}`)];
  return "﻿" + out.join("\n");
}
