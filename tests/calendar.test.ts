import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, ownerRescheduleBooking } from "@/lib/booking";
import { uuid } from "@/lib/db";
import { apptsInRange, parseYmd, shiftAnchor, sickLeavePreview, viewRange, ymdKey } from "@/lib/calendar";
import { zonedToUtc } from "@/lib/tz";

type Ctx = Awaited<ReturnType<typeof setup>>;
const avail = (c: Ctx, svc = c.consult.id, days = 30) => getAvailability(c.db, { tenantId: c.tenantId, serviceId: svc, now: NOW, days });
const rule = (c: Ctx, svc: string, o: { weekdays?: string; earliest?: number | null; latest?: number | null; max?: number | null; before?: number }) =>
  c.db.run("INSERT INTO service_rules(service_id,tenant_id,weekdays,earliest_min,latest_min,max_per_day,buffer_before_min,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
    [svc, c.tenantId, o.weekdays ?? "0,1,2,3,4,5,6", o.earliest ?? null, o.latest ?? null, o.max ?? null, o.before ?? 0, NOW.toISOString()]);
const book = (c: Ctx, startUtc: string, i = 1, svc = c.consult.id) => createBooking(c.db, { tenantId: c.tenantId, serviceId: svc, startsAtUtc: startUtc, client: person(i), idempotencyKey: key(), consentService: true, now: NOW });
const wdOf = (iso: string) => new Date(iso).getUTCDay();

describe("правила по услугам", () => {
  it("без правил услуга доступна по рабочим дням, как раньше", async () => {
    const c = await setup();
    expect((await avail(c)).length).toBeGreaterThan(20);
  });
  it("только выбранные дни недели", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { weekdays: "2" }); // вторник
    const s = await avail(c);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => wdOf(x.startUtc) === 2)).toBe(true);
  });
  it("окно начала: не раньше 10:00 и не позже 12:00", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { earliest: 600, latest: 720 });
    const hours = new Set((await avail(c)).map((x) => x.startUtc.slice(11, 16)));
    expect([...hours].sort()).toEqual(["10:00", "11:00", "12:00"]);
  });
  it("лимит в день: после N записей день закрывается для этой услуги, соседние дни остаются", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { max: 2 });
    const first = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-09"));
    await book(c, first[0].startUtc, 1);
    expect((await avail(c)).some((x) => x.startUtc.startsWith("2026-11-09"))).toBe(true);
    await book(c, first[3].startUtc, 2);
    const after = await avail(c);
    expect(after.some((x) => x.startUtc.startsWith("2026-11-09"))).toBe(false);
    expect(after.some((x) => x.startUtc.startsWith("2026-11-10"))).toBe(true);
    await expect(book(c, first[5].startUtc, 3)).rejects.toMatchObject({ code: "slot_unavailable" });
  });
  it("отмена освобождает дневной лимит", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { max: 1 });
    const s = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-09"));
    const r = await book(c, s[0].startUtc, 1);
    expect((await avail(c)).some((x) => x.startUtc.startsWith("2026-11-09"))).toBe(false);
    await c.db.run("UPDATE appointments SET status='cancelled' WHERE id=?1", [r.appointmentId]);
    expect((await avail(c)).some((x) => x.startUtc.startsWith("2026-11-09"))).toBe(true);
  });
  it("перенос в тот же день не упирается в собственный лимит", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { max: 1 });
    const s = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-09"));
    const r = await book(c, s[0].startUtc, 1);
    const moved = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 3, excludeAppointmentId: r.appointmentId });
    expect(moved.some((x) => x.startUtc === s[4].startUtc)).toBe(true);
    await expect(ownerRescheduleBooking(c.db, { tenantId: c.tenantId, id: r.appointmentId, newStartUtc: s[4].startUtc, now: NOW })).resolves.toBeDefined();
  });
  it("подготовка ДО записи: соседний слот перед чужой записью не предлагается", async () => {
    const c = await setup();
    await rule(c, c.consult.id, { before: 30 });
    const s = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-10"));
    const t = (h: number) => s.find((x) => x.startUtc.slice(11, 13) === String(h).padStart(2, "0"))!.startUtc;
    await book(c, t(10), 1); // консультация длится дольше часа? проверяем только факт сдвига
    const after = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-10")).map((x) => x.startUtc);
    expect(after).not.toContain(t(10));
    // слот сразу после занятого не предлагается, пока не прошла подготовка ДО него
    const endMs = new Date(s.find((x) => x.startUtc === t(10))!.endUtc).getTime();
    for (const a of after) { const st = new Date(a).getTime(); if (st >= endMs) expect(st - 30 * 60000 >= endMs + c.consult.buffer_min * 60000).toBe(true); }
  });
  it("подготовка до УЖЕ существующей записи (другой услуги) учитывается при выборе слота перед ней", async () => {
    const c = await setup();
    const other = c.services.find((x) => x.id !== c.consult.id)!;
    await rule(c, other.id, { before: 60 });
    const day = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: other.id, now: NOW, days: 3 })).filter((x) => x.startUtc.startsWith("2026-11-10"));
    const at = day[2];
    await book(c, at.startUtc, 1, other.id);
    const before = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-10"));
    const atMs = new Date(at.startUtc).getTime();
    for (const b of before) { const e = new Date(b.endUtc).getTime() + c.consult.buffer_min * 60000; if (e <= atMs + 1) expect(e <= atMs - 60 * 60000).toBe(true); }
  });
  it("правила других клиентов (tenant) не влияют", async () => {
    const c = await setup();
    await c.db.run("INSERT INTO service_rules(service_id,tenant_id,weekdays,updated_at) VALUES (?1,?2,'2',?3)", [c.consult.id, c.tenantB, NOW.toISOString()]).catch(() => undefined);
    expect(new Set((await avail(c)).map((x) => wdOf(x.startUtc))).size).toBeGreaterThan(1);
  });
});

describe("виды календаря", () => {
  it("неделя начинается с понедельника, месяц — полная сетка пн–вс", () => {
    const w = viewRange("week", { y: 2026, mo: 11, d: 12 });
    expect(ymdKey(w.first)).toBe("2026-11-09"); expect(w.days).toBe(7);
    const m = viewRange("month", { y: 2026, mo: 11, d: 12 });
    expect(ymdKey(m.first)).toBe("2026-10-26"); expect(m.days % 7).toBe(0); expect(m.days).toBe(42);
    expect(ymdKey(viewRange("month", { y: 2026, mo: 2, d: 1 }).first)).toBe("2026-01-26");
  });
  it("переходы назад/вперёд, в том числе через границу года", () => {
    expect(ymdKey(shiftAnchor("month", { y: 2026, mo: 12, d: 15 }, 1))).toBe("2027-01-01");
    expect(ymdKey(shiftAnchor("month", { y: 2026, mo: 1, d: 15 }, -1))).toBe("2025-12-01");
    expect(ymdKey(shiftAnchor("week", { y: 2026, mo: 12, d: 28 }, 1))).toBe("2027-01-04");
  });
  it("parseYmd отвергает несуществующие даты", () => {
    expect(parseYmd("2026-02-30")).toBeNull(); expect(parseYmd("abc")).toBeNull(); expect(parseYmd("2026-11-09")).not.toBeNull();
  });
  it("записи группируются по местным суткам, отменённые не показываются, чужой tenant не виден", async () => {
    const c = await setup();
    const s = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-10"));
    const r1 = await book(c, s[0].startUtc, 1); await book(c, s[3].startUtc, 2);
    await c.db.run("UPDATE appointments SET status='cancelled' WHERE id=?1", [r1.appointmentId]);
    const m = await apptsInRange(c.db, c.tenantId, { y: 2026, mo: 11, d: 9 }, 7);
    expect(m.get("2026-11-10")?.length).toBe(1);
    expect((await apptsInRange(c.db, c.tenantB, { y: 2026, mo: 11, d: 9 }, 7)).size).toBe(0);
  });
  it("запись в 00:30 местного времени в день перевода часов попадает в свой день", async () => {
    const c = await setup();
    const z = zonedToUtc(2026, 10, 25, 0, 30) as { utcMs: number }; // воскресенье, ночь перевода часов в Дублине
    await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: new Date(z.utcMs).toISOString(), client: person(5), idempotencyKey: key(), consentService: true, ownerOverride: true, now: NOW });
    const m = await apptsInRange(c.db, c.tenantId, { y: 2026, mo: 10, d: 24 }, 3);
    expect([...m.keys()]).toEqual(["2026-10-25"]);
  });
});

describe("больничный (превью)", () => {
  it("показывает затронутые записи и НИЧЕГО не меняет", async () => {
    const c = await setup();
    const s = (await avail(c)).filter((x) => x.startUtc.startsWith("2026-11-10") || x.startUtc.startsWith("2026-11-11"));
    await book(c, s[0].startUtc, 1); await book(c, s[s.length - 1].startUtc, 2);
    const before = await c.db.all("SELECT id,status,start_at,version FROM appointments ORDER BY id");
    const notif = await c.db.all("SELECT count(*) n FROM notifications");
    const p = await sickLeavePreview(c.db, c.tenantId, { y: 2026, mo: 11, d: 10 }, { y: 2026, mo: 11, d: 11 });
    expect(p.total).toBe(2);
    expect(await c.db.all("SELECT id,status,start_at,version FROM appointments ORDER BY id")).toEqual(before);
    expect(await c.db.all("SELECT count(*) n FROM notifications")).toEqual(notif);
  });
  it("слишком длинный период отклоняется", async () => {
    const c = await setup();
    expect((await sickLeavePreview(c.db, c.tenantId, { y: 2026, mo: 1, d: 1 }, { y: 2026, mo: 12, d: 31 })).days).toBe(0);
  });
});

describe("лист ожидания", () => {
  it("таблица принимает запись и ограничивает неверный период и статус", async () => {
    const c = await setup();
    const ins = (from: string, to: string, st = "waiting") => c.db.run("INSERT INTO waitlist(id,tenant_id,service_id,client_name,contact,day_from,day_to,status,created_at) VALUES (?1,?2,?3,'X','x@example.com',?4,?5,?6,?7)", [uuid(), c.tenantId, c.consult.id, from, to, st, NOW.toISOString()]);
    await ins("2026-11-10", "2026-11-14");
    await expect(ins("2026-11-14", "2026-11-10")).rejects.toThrow();
    await expect(ins("2026-11-10", "2026-11-14", "weird")).rejects.toThrow();
  });
});
