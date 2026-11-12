import { rows, type Db } from "./db";
import { addLocalDays, localParts, weekdayOfLocalDate, zonedToUtc } from "./tz";

export type View = "day" | "week" | "month";
export const isView = (v: unknown): v is View => v === "day" || v === "week" || v === "month";
export type Ymd = { y: number; mo: number; d: number };
export const ymdKey = (x: Ymd) => `${x.y}-${String(x.mo).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;
export const parseYmd = (s: unknown): Ymd | null => {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return t.getUTCFullYear() === +m[1] && t.getUTCMonth() === +m[2] - 1 && t.getUTCDate() === +m[3] ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
export const todayYmd = (nowMs: number): Ymd => { const p = localParts(nowMs); return { y: p.y, mo: p.mo, d: p.d }; };
const startOfDay = (x: Ymd) => (zonedToUtc(x.y, x.mo, x.d, 0, 0) as { utcMs: number }).utcMs;

/** Первый день отображаемого диапазона и число дней: день, неделя с понедельника, полная сетка месяца (пн–вс) */
export function viewRange(view: View, anchor: Ymd): { first: Ymd; days: number } {
  if (view === "day") return { first: anchor, days: 1 };
  if (view === "week") {
    const wd = (weekdayOfLocalDate(anchor.y, anchor.mo, anchor.d) + 6) % 7; // 0 = понедельник
    return { first: addLocalDays(anchor.y, anchor.mo, anchor.d, -wd), days: 7 };
  }
  const f = { y: anchor.y, mo: anchor.mo, d: 1 };
  const wd = (weekdayOfLocalDate(f.y, f.mo, 1) + 6) % 7;
  const dim = new Date(Date.UTC(f.y, f.mo, 0)).getUTCDate();
  return { first: addLocalDays(f.y, f.mo, 1, -wd), days: Math.ceil((wd + dim) / 7) * 7 };
}
/** Соседний период для кнопок «назад/вперёд» */
export function shiftAnchor(view: View, a: Ymd, dir: -1 | 1): Ymd {
  if (view === "day") return addLocalDays(a.y, a.mo, a.d, dir);
  if (view === "week") return addLocalDays(a.y, a.mo, a.d, 7 * dir);
  const t = new Date(Date.UTC(a.y, a.mo - 1 + dir, 1));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: 1 };
}

export type CalAppt = { id: string; start_at: string; end_at: string; status: string; name: string; title_i18n: Record<string, string>; test: boolean };
/** Записи диапазона [first, first+days) по местным суткам Дублина, сгруппированные по дате. Отменённые и удержания не показываются. */
export async function apptsInRange(db: Db, tenantId: string, first: Ymd, days: number): Promise<Map<string, CalAppt[]>> {
  const from = new Date(startOfDay(first)).toISOString();
  const end = addLocalDays(first.y, first.mo, first.d, days);
  const to = new Date(startOfDay(end)).toISOString();
  const r = await rows<{ id: string; start_at: string; end_at: string; status: string; name: string; title_i18n: Record<string, string>; source: Record<string, string> }>(db,
    `SELECT a.id,a.start_at,a.end_at,a.status,c.name,s.title_i18n,a.source FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
     WHERE a.tenant_id=?1 AND a.status IN ('confirmed','requested','completed','no_show') AND a.start_at >= ?2 AND a.start_at < ?3 ORDER BY a.start_at`, [tenantId, from, to]);
  const out = new Map<string, CalAppt[]>();
  for (const x of r) {
    const k = ymdKey(localParts(new Date(x.start_at).getTime()));
    (out.get(k) ?? out.set(k, []).get(k)!).push({ id: x.id, start_at: x.start_at, end_at: x.end_at, status: x.status, name: x.name, title_i18n: x.title_i18n, test: x.source?.test === "1" });
  }
  return out;
}

/** Больничный: какие записи попадают в выбранные дни. Ничего не меняет и никому ничего не отправляет. */
export async function sickLeavePreview(db: Db, tenantId: string, fromDay: Ymd, toDay: Ymd) {
  const days = Math.round((Date.UTC(toDay.y, toDay.mo - 1, toDay.d) - Date.UTC(fromDay.y, fromDay.mo - 1, fromDay.d)) / 86400000) + 1;
  if (days < 1 || days > 62) return { days: 0, byDay: new Map<string, CalAppt[]>(), total: 0 };
  const byDay = await apptsInRange(db, tenantId, fromDay, days);
  const open = new Map<string, CalAppt[]>();
  let total = 0;
  for (const [k, list] of byDay) { const l = list.filter((a) => a.status === "confirmed" || a.status === "requested"); if (l.length) { open.set(k, l); total += l.length; } }
  return { days, byDay: open, total };
}
