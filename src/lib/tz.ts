// Работа со временем Europe/Dublin. В базе всегда UTC, местное время считаем по правилам зоны.
export const DEFAULT_TZ = "Europe/Dublin";

/** Смещение зоны (в минутах) в данный момент UTC. */
export function offsetMinutes(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

export type ZonedResult =
  | { status: "ok"; utcMs: number }
  | { status: "nonexistent" }                       // «весенний» пропущенный час
  | { status: "ambiguous"; earlierUtcMs: number; laterUtcMs: number }; // «осенний» повторный час

/** Местное время (как на стене) → UTC с явной обработкой перехода на летнее/зимнее время. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz = DEFAULT_TZ): ZonedResult {
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offs = new Set([offsetMinutes(naive - 86400000, tz), offsetMinutes(naive + 86400000, tz)]);
  const valid: number[] = [];
  for (const o of offs) {
    const t = naive - o * 60000;
    if (offsetMinutes(t, tz) === o) valid.push(t);
  }
  valid.sort((a, b) => a - b);
  if (valid.length === 0) return { status: "nonexistent" };
  if (valid.length === 1) return { status: "ok", utcMs: valid[0] };
  return { status: "ambiguous", earlierUtcMs: valid[0], laterUtcMs: valid[1] };
}

export function localParts(utcMs: number, tz = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { y: +g("year"), mo: +g("month"), d: +g("day"), h: +g("hour"), mi: +g("minute"), wd: g("weekday") };
}

export function formatLocal(utcMs: number, locale: string, tz = DEFAULT_TZ): string {
  const loc = locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-IE";
  return new Intl.DateTimeFormat(loc, { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(utcMs));
}

/** Дни недели местной даты: 0=Вс … 6=Сб. */
export function weekdayOfLocalDate(y: number, mo: number, d: number): number {
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function addLocalDays(y: number, mo: number, d: number, n: number) {
  const t = new Date(Date.UTC(y, mo - 1, d + n));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
