import { describe, it, expect } from "vitest";
import { parseTimePrefs, slotMatches } from "@/lib/timeprefs";
import { zonedToUtc } from "@/lib/tz";

// Понедельник 2026-11-09, 10:00 по Дублину
const NOW = new Date("2026-11-09T10:00:00Z");
const at = (y: number, mo: number, d: number, h: number, mi = 0) => { const z = zonedToUtc(y, mo, d, h, mi); if (z.status !== "ok") throw new Error("tz"); return z.utcMs; };

describe("пожелания ко времени (RU / EN / UA)", () => {
  it("завтра / tomorrow / завтра утром", () => {
    expect(parseTimePrefs("Есть свободное время завтра утром?", NOW)).toMatchObject({ fromDate: "2026-11-10", toDate: "2026-11-10", beforeMin: 720 });
    expect(parseTimePrefs("Any time tomorrow?", NOW)).toMatchObject({ fromDate: "2026-11-10" });
    expect(parseTimePrefs("Є вільний час завтра ввечері?", NOW)).toMatchObject({ fromDate: "2026-11-10", afterMin: 17 * 60 });
  });
  it("в пятницу после 16:00", () => {
    const p = parseTimePrefs("Можно в пятницу после 16:00?", NOW);
    expect(p).toMatchObject({ weekday: 5, afterMin: 960 });
    expect(slotMatches(at(2026, 11, 13, 16, 30), p)).toBe(true);
    expect(slotMatches(at(2026, 11, 13, 15, 30), p)).toBe(false);
    expect(slotMatches(at(2026, 11, 12, 17), p)).toBe(false);
  });
  it("следующая неделя: понедельник–воскресенье после текущей", () => {
    const p = parseTimePrefs("Хочу консультацию на следующей неделе", NOW);
    expect(p).toMatchObject({ fromDate: "2026-11-16", toDate: "2026-11-22" });
    expect(slotMatches(at(2026, 11, 17, 14), p)).toBe(true);
    expect(slotMatches(at(2026, 11, 13, 14), p)).toBe(false);
    expect(parseTimePrefs("next week please", NOW)).toMatchObject({ fromDate: "2026-11-16" });
    expect(parseTimePrefs("наступного тижня", NOW)).toMatchObject({ fromDate: "2026-11-16" });
  });
  it("перевод часов: пожелание считается по местному времени (DST)", () => {
    // 2026-10-25 переход на зимнее время в Ирландии; слот в 10:00 местного остаётся 10:00
    const p = parseTimePrefs("после 9", new Date("2026-10-20T10:00:00Z"));
    expect(slotMatches(at(2026, 10, 26, 10), p)).toBe(true);
    expect(slotMatches(at(2026, 10, 26, 8, 30), p)).toBe(false);
  });
  it("без пожеланий возвращает пустой объект", () => {
    expect(parseTimePrefs("Хочу записаться", NOW)).toEqual({});
  });
});
