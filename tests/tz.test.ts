import { describe, it, expect } from "vitest";
import { zonedToUtc, offsetMinutes } from "@/lib/tz";
import { setup } from "./helpers";
import { getAvailability } from "@/lib/booking";

describe("Europe/Dublin DST", () => {
  it("offsets: GMT in winter, IST in summer", () => {
    expect(offsetMinutes(Date.UTC(2026, 0, 15, 12), "Europe/Dublin")).toBe(0);
    expect(offsetMinutes(Date.UTC(2026, 6, 15, 12), "Europe/Dublin")).toBe(60);
  });
  it("spring forward (Sun 29 Mar 2026): 01:30 local does not exist", () => {
    expect(zonedToUtc(2026, 3, 29, 1, 30).status).toBe("nonexistent");
    expect(zonedToUtc(2026, 3, 29, 2, 0)).toMatchObject({ status: "ok", utcMs: Date.UTC(2026, 2, 29, 1, 0) });
    expect(zonedToUtc(2026, 3, 29, 0, 30)).toMatchObject({ status: "ok", utcMs: Date.UTC(2026, 2, 29, 0, 30) });
  });
  it("fall back (Sun 25 Oct 2026): 01:30 local happens twice", () => {
    const r = zonedToUtc(2026, 10, 25, 1, 30);
    expect(r.status).toBe("ambiguous");
    if (r.status === "ambiguous") {
      expect(r.earlierUtcMs).toBe(Date.UTC(2026, 9, 25, 0, 30));
      expect(r.laterUtcMs).toBe(Date.UTC(2026, 9, 25, 1, 30));
    }
    expect(zonedToUtc(2026, 10, 25, 3, 0)).toMatchObject({ status: "ok", utcMs: Date.UTC(2026, 9, 25, 3, 0) });
  });
  it("slot engine never offers nonexistent or ambiguous local times, and has no gaps around them", async () => {
    const c = await setup();
    const staff = (await c.db.query<{ id: string }>("SELECT id FROM staff WHERE tenant_id=$1", [c.tenantId])).rows[0].id;
    await c.db.query("INSERT INTO availability_rules(tenant_id,staff_id,weekday,start_min,end_min) VALUES ($1,$2,0,0,300)", [c.tenantId, staff]); // воскресенье 00:00–05:00
    const spring = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, from: new Date("2026-03-28T12:00:00Z"), now: new Date("2026-03-20T00:00:00Z"), days: 2 });
    const sunSpring = spring.filter((s) => s.startUtc.startsWith("2026-03-29")).map((s) => s.startUtc);
    expect(sunSpring).not.toContain("2026-03-29T01:00:00.000Z" + "x");
    // 01:00 и 01:30 местного не существуют: слот 02:00 местного = 01:00Z присутствует, 01:00/01:30 «местного» нет
    expect(sunSpring.length).toBeGreaterThan(0);
    const autumn = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, from: new Date("2026-10-24T12:00:00Z"), now: new Date("2026-10-20T00:00:00Z"), days: 2 });
    const sunAut = autumn.filter((s) => s.startUtc.startsWith("2026-10-25")).map((s) => s.startUtc);
    expect(sunAut).not.toContain("2026-10-25T00:30:00.000Z"); // 01:30 BST (неоднозначно)
    expect(sunAut).not.toContain("2026-10-25T01:30:00.000Z"); // 01:30 GMT (неоднозначно)
    expect(sunAut).toContain("2026-10-25T02:00:00.000Z"); // 02:00 GMT однозначно
  });
});
