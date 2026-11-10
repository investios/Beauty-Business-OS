import { addLocalDays, localParts, weekdayOfLocalDate } from "./tz";

/** Пожелания клиента ко времени, понятые из фразы (RU / EN / UA). Всё в локальном времени студии (Europe/Dublin). */
export type TimePrefs = {
  weekday?: number;                        // 0=Вс … 6=Сб
  fromDate?: string; toDate?: string;      // YYYY-MM-DD включительно
  afterMin?: number; beforeMin?: number;   // минуты от полуночи: начало не раньше / не позже
};

const WEEKDAY: [RegExp, number][] = [
  [/monday|понедел|понеділ/i, 1], [/tuesday|вторник|вівторок/i, 2], [/wednesday|сред[ау]|середа|середу/i, 3], [/thursday|четверг|четвер/i, 4],
  [/friday|пятниц|п['’]ятниц/i, 5], [/saturday|суббот|субот/i, 6], [/sunday|воскрес|неділ/i, 0],
];
const key = (d: { y: number; mo: number; d: number }) => `${d.y}-${String(d.mo).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;

export function parseTimePrefs(text: string, now: Date, tz?: string): TimePrefs {
  const t = text.toLowerCase();
  const p: TimePrefs = {};
  const today = localParts(now.getTime(), tz);
  const day = (n: number) => key(addLocalDays(today.y, today.mo, today.d, n));

  if (/послезавтра|day after tomorrow|післязавтра/.test(t)) { p.fromDate = p.toDate = day(2); }
  else if (/завтра|tomorrow/.test(t)) { p.fromDate = p.toDate = day(1); }
  else if (/сегодня|сьогодні|\btoday\b/.test(t)) { p.fromDate = p.toDate = day(0); }
  else if (/следующ\S+ недел|наступн\S+ тижн|next week/.test(t)) {
    const toMonday = ((8 - weekdayOfLocalDate(today.y, today.mo, today.d)) % 7) || 7;
    p.fromDate = day(toMonday); p.toDate = day(toMonday + 6);
  } else if (/на этой неделе|цього тижня|this week/.test(t)) {
    const toSunday = (7 - weekdayOfLocalDate(today.y, today.mo, today.d)) % 7;
    p.fromDate = day(0); p.toDate = day(toSunday);
  }
  const wd = WEEKDAY.find(([re]) => re.test(t))?.[1];
  if (wd != null) p.weekday = wd;

  const hhmm = (s: string) => { const m = s.match(/(\d{1,2})(?:[:.](\d{2}))?/); if (!m) return undefined; const h = +m[1], mi = +(m[2] ?? 0); return h <= 23 && mi <= 59 ? h * 60 + mi : undefined; };
  const after = t.match(/(?:после|після|after|from|с|з|від)\s+(\d{1,2}(?:[:.]\d{2})?)/);
  const before = t.match(/(?:до|before|by|раньше)\s+(\d{1,2}(?:[:.]\d{2})?)/);
  if (after) p.afterMin = hhmm(after[1]);
  if (before) p.beforeMin = hhmm(before[1]);
  if (p.afterMin == null && p.beforeMin == null) {
    if (/утр|ранок|ранку|morning/.test(t)) { p.beforeMin = 12 * 60; }
    else if (/вечер|вечір|evening/.test(t)) { p.afterMin = 17 * 60; }
    else if (/днём|днем|вдень|afternoon/.test(t)) { p.afterMin = 12 * 60; p.beforeMin = 17 * 60; }
  }
  return p;
}

export const hasPrefs = (p: TimePrefs) => Object.keys(p).length > 0;

/** Подходит ли начало слота под пожелания (время слота в локальном часовом поясе студии) */
export function slotMatches(startUtcMs: number, p: TimePrefs, tz?: string): boolean {
  const lp = localParts(startUtcMs, tz);
  const k = key(lp), mins = lp.h * 60 + lp.mi;
  if (p.weekday != null && weekdayOfLocalDate(lp.y, lp.mo, lp.d) !== p.weekday) return false;
  if (p.fromDate && k < p.fromDate) return false;
  if (p.toDate && k > p.toDate) return false;
  if (p.afterMin != null && mins < p.afterMin) return false;
  if (p.beforeMin != null && mins >= p.beforeMin) return false;
  return true;
}
