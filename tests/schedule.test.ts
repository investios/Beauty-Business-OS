import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { BookingError, createBooking, getAvailability, getScheduleSettings } from "@/lib/booking";
import { uuid } from "@/lib/db";
import { zonedToUtc } from "@/lib/tz";

type Ctx = Awaited<ReturnType<typeof setup>>;
const avail = (c: Ctx, svc = c.consult.id, days = 30) => getAvailability(c.db, { tenantId: c.tenantId, serviceId: svc, now: NOW, days });
const dayOf = (iso: string) => iso.slice(0, 10);
const exc = (c: Ctx, day: string, kind: "closed" | "open", a: number | null, b: number | null) =>
  c.db.run("INSERT INTO schedule_exceptions(id,tenant_id,day,kind,start_min,end_min,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", [uuid(), c.tenantId, day, kind, a, b, NOW.toISOString()]);

describe("расписание мастера", () => {
  it("по умолчанию: пн–пт 08:00–17:00, шаг 1 час, без ограничения «не раньше чем через 2 часа»", async () => {
    const c = await setup();
    expect(await getScheduleSettings(c.db, c.tenantId)).toEqual({ stepMin: 60, minNoticeMin: 0, horizonDays: 183 });
    const s = await avail(c);
    expect(s[0].startUtc).toBe("2026-11-09T08:00:00.000Z"); // понедельник, слот в момент «сейчас» доступен
    expect(s.every((x) => new Date(x.startUtc).getUTCMinutes() === 0)).toBe(true);
  });
  it("выходной день убирает все слоты этой даты", async () => {
    const c = await setup();
    await exc(c, "2026-11-10", "closed", null, null);
    expect((await avail(c)).some((x) => dayOf(x.startUtc) === "2026-11-10")).toBe(false);
    expect((await avail(c)).some((x) => dayOf(x.startUtc) === "2026-11-11")).toBe(true);
  });
  it("закрытый промежуток внутри дня блокирует только пересекающиеся слоты", async () => {
    const c = await setup();
    await exc(c, "2026-11-10", "closed", 12 * 60, 14 * 60); // обед
    const t = (await avail(c)).filter((x) => dayOf(x.startUtc) === "2026-11-10").map((x) => x.startUtc.slice(11, 16));
    expect(t).toContain("11:00"); // 11:00–11:45 + буфер заканчивается до 12:00? слот 11:00 занимает 45 мин, пересечения с 12:00 нет
    expect(t).not.toContain("12:00"); expect(t).not.toContain("13:00");
    expect(t).toContain("14:00");
  });
  it("воскресенье можно открыть дополнительно, а ночные часы, например 23:00, возможны", async () => {
    const c = await setup();
    await exc(c, "2026-11-15", "open", 10 * 60, 12 * 60); // воскресенье
    await exc(c, "2026-11-11", "open", 22 * 60, 24 * 60);   // позднее время
    const s = await avail(c);
    expect(s.filter((x) => dayOf(x.startUtc) === "2026-11-15").map((x) => x.startUtc.slice(11, 16))).toEqual(["10:00", "11:00"]);
    expect(s.some((x) => x.startUtc === "2026-11-11T23:00:00.000Z")).toBe(true);
  });
  it("шаг и срок до записи настраиваются", async () => {
    const c = await setup();
    await c.db.run("INSERT INTO schedule_settings(tenant_id,step_min,min_notice_min,horizon_days) VALUES (?1,30,120,10)", [c.tenantId]);
    const s = await avail(c, c.consult.id, 60);
    expect(s[0].startUtc).toBe("2026-11-09T10:00:00.000Z"); // 08:00 + 2 часа
    expect(s.some((x) => x.startUtc === "2026-11-09T10:30:00.000Z")).toBe(true);
    expect(s[s.length - 1].startUtc <= "2026-11-19T08:00:00.000Z").toBe(true); // горизонт 10 дней
  });
  it("длинная услуга блокирует следующих клиентов на всё своё время", async () => {
    const c = await setup();
    const ext = c.services.find((x) => x.slug !== "consultation")!;
    await c.db.run("UPDATE services SET duration_min=240,buffer_min=0 WHERE id=?1", [ext.id]);
    const first = (await avail(c, ext.id)).find((x) => x.startUtc === "2026-11-10T09:00:00.000Z")!;
    await createBooking(c.db, { tenantId: c.tenantId, serviceId: ext.id, startsAtUtc: first.startUtc, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    const t = (await avail(c, c.consult.id)).filter((x) => dayOf(x.startUtc) === "2026-11-10").map((x) => x.startUtc.slice(11, 16));
    expect(t).toContain("08:00"); // до 09:00 консультация 45 мин + 15 буфер ещё влезает
    for (const bad of ["09:00", "10:00", "11:00", "12:00"]) expect(t).not.toContain(bad); // 09:00–13:00 занято
    expect(t).toContain("13:00");
  });
  it("мастер записывает клиента на любое время, например воскресенье 17:15; занятость защищена", async () => {
    const c = await setup();
    const z = zonedToUtc(2026, 11, 15, 17, 15); if (z.status !== "ok") throw new Error("tz");
    const start = new Date(z.utcMs).toISOString();
    await expect(createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: start, client: person(), idempotencyKey: key(), consentService: true, now: NOW })).rejects.toBeInstanceOf(BookingError); // клиент не может
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: start, client: person(2), idempotencyKey: key(), consentService: true, ownerOverride: true, now: NOW });
    expect(r.status).toBe("confirmed"); expect(r.startsAtUtc).toBe("2026-11-15T17:15:00.000Z");
    await expect(createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: start, client: person(3), idempotencyKey: key(), consentService: true, ownerOverride: true, now: NOW })).rejects.toBeInstanceOf(BookingError); // двойной записи нет
  });
});
