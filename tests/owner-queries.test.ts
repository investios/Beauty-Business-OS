import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability } from "@/lib/booking";
import { APPT_FILTERS, countAppts, listAppts, recentActivity, type ApptFilter } from "@/lib/owner-queries";

type Ctx = Awaited<ReturnType<typeof setup>>;
async function seedBookings(c: Ctx, n: number) {
  const slots = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 });
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: slots[i * 4].startUtc, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    ids.push(r.appointmentId);
  }
  return ids;
}

describe("кабинет: цифры плиток равны числу строк в списках", () => {
  it("для каждого фильтра счётчик совпадает со списком", async () => {
    const c = await setup();
    const ids = await seedBookings(c, 6);
    await c.db.run("UPDATE appointments SET status='cancelled' WHERE id=?1", [ids[0]]);
    await c.db.run("UPDATE appointments SET status='requested' WHERE id=?1", [ids[1]]);
    await c.db.run("UPDATE appointments SET status='completed', start_at='2026-11-01T10:00:00.000Z', end_at='2026-11-01T11:00:00.000Z', blocked_until='2026-11-01T11:00:00.000Z' WHERE id=?1", [ids[2]]);
    for (const f of Object.keys(APPT_FILTERS) as ApptFilter[]) {
      const n = await countAppts(c.db, c.tenantId, f, NOW.getTime());
      const list = await listAppts(c.db, c.tenantId, f, NOW.getTime(), { limit: 100 });
      expect(list.length, `фильтр ${f}`).toBe(n);
    }
    expect(await countAppts(c.db, c.tenantId, "all", NOW.getTime())).toBe(6);
    expect(await countAppts(c.db, c.tenantId, "cancelled", NOW.getTime())).toBe(1);
    expect(await countAppts(c.db, c.tenantId, "requested", NOW.getTime())).toBe(1);
    expect(await countAppts(c.db, c.tenantId, "past", NOW.getTime())).toBe(1);
  });
  it("поиск сужает и счётчик, и список одинаково; пагинация не теряет строки", async () => {
    const c = await setup();
    await seedBookings(c, 5);
    const some = (await listAppts(c.db, c.tenantId, "all", NOW.getTime(), { limit: 1 }))[0];
    const part = some.name.slice(0, 4);
    const n = await countAppts(c.db, c.tenantId, "all", NOW.getTime(), part);
    expect((await listAppts(c.db, c.tenantId, "all", NOW.getTime(), { q: part, limit: 100 })).length).toBe(n);
    const p1 = await listAppts(c.db, c.tenantId, "all", NOW.getTime(), { limit: 2, offset: 0 });
    const p2 = await listAppts(c.db, c.tenantId, "all", NOW.getTime(), { limit: 2, offset: 2 });
    expect(new Set([...p1, ...p2].map((x) => x.id)).size).toBe(4);
  });
  it("другой салон ничего не видит; журнал действий содержит создание записи", async () => {
    const c = await setup();
    await seedBookings(c, 2);
    expect(await countAppts(c.db, "other-tenant", "all", NOW.getTime())).toBe(0);
    expect((await recentActivity(c.db, c.tenantId)).some((e) => e.action === "booking.create")).toBe(true);
    expect(await recentActivity(c.db, "other-tenant")).toHaveLength(0);
  });
});
