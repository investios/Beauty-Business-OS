import type { Policies } from "./policies";
import { addLocalDays, localParts, zonedToUtc } from "./tz";

/** reminder_24h исторически означает «вечером накануне» (19:00 по Дублину); остальные добавлены по ТЗ v2.0 */
export type ReminderKind = "reminder_24h" | "reminder_2d" | "reminder_morning" | "reminder_1h";
export const REMINDER_KINDS: ReminderKind[] = ["reminder_24h", "reminder_2d", "reminder_morning", "reminder_1h"];
const localAt = (ms: number, dayOffset: number, h: number): Date | null => {
  const p = localParts(ms), d = addLocalDays(p.y, p.mo, p.d, dayOffset), z = zonedToUtc(d.y, d.mo, d.d, h, 0);
  return z.status === "ok" ? new Date(z.utcMs) : null;
};

/** Какие напоминания поставить для записи. Только будущие моменты; повторный вызов даёт тот же набор. */
export function planReminders(start: Date, now: Date, pol: Policies): { kind: ReminderKind; at: Date }[] {
  const out: { kind: ReminderKind; at: Date }[] = [];
  const s = start.getTime();
  if (pol.remind_evening_before) { const at = localAt(s, -1, 19); if (at) out.push({ kind: "reminder_24h", at }); }
  if (pol.remind_two_days && s - now.getTime() >= pol.remind_two_days_min_ahead_days * 86400000) out.push({ kind: "reminder_2d", at: new Date(s - 48 * 3600000) });
  if (pol.remind_morning) { const at = localAt(s, 0, 9); if (at && at.getTime() < s) out.push({ kind: "reminder_morning", at }); }
  if (pol.remind_one_hour) out.push({ kind: "reminder_1h", at: new Date(s - 3600000) });
  return out.filter((r) => r.at.getTime() > now.getTime());
}
