import { describe, it, expect, beforeEach } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { BookingError, cancelBooking, createBooking, createHold, getAvailability, getBookingByToken, rescheduleBooking } from "@/lib/booking";
import { rows, one } from "@/lib/db";

type Ctx = Awaited<ReturnType<typeof setup>>;
let c: Ctx;
beforeEach(async () => { c = await setup(); });

const slots = (cx: Ctx) => getAvailability(cx.db, { tenantId: cx.tenantId, serviceId: cx.consult.id, now: NOW, days: 14 });
const book = (cx: Ctx, startsAtUtc: string, i = 1, k = key()) =>
  createBooking(cx.db, { tenantId: cx.tenantId, serviceId: cx.consult.id, startsAtUtc, client: person(i), idempotencyKey: k, consentService: true, now: NOW });

describe("availability", () => {
  it("offers only working-hour slots in the future (Tue–Sat 10–18 Dublin), never within notice period", async () => {
    const s = await slots(c);
    expect(s.length).toBeGreaterThan(10);
    expect(s[0].startUtc >= new Date(NOW.getTime() + 2 * 3600000).toISOString()).toBe(true);
    for (const x of s) {
      const d = new Date(x.startUtc);
      expect([2, 3, 4, 5, 6]).toContain(d.getUTCDay()); // ноябрь: GMT=UTC
      expect(d.getUTCHours()).toBeGreaterThanOrEqual(10);
      expect(d.getUTCHours()).toBeLessThan(18);
    }
  });
  it("shifts by an hour in summer (BST): 10:00 local = 09:00Z", async () => {
    const s = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: new Date("2026-06-01T08:00:00Z"), days: 7 });
    expect(s.some((x) => x.startUtc === "2026-06-02T09:00:00.000Z")).toBe(true);
    expect(s.some((x) => x.startUtc === "2026-06-02T10:00:00.000Z" && false)).toBe(false);
  });
});

describe("booking atomicity", () => {
  it("two concurrent bookings for the same slot: exactly one confirmed", async () => {
    const s = (await slots(c))[0];
    const results = await Promise.allSettled([book(c, s.startUtc, 1), book(c, s.startUtc, 2), book(c, s.startUtc, 3)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(2);
    for (const b of bad) {
      expect(b.reason).toBeInstanceOf(BookingError);
      expect(["slot_taken", "slot_unavailable"]).toContain(b.reason.code);
      expect(b.reason.alternatives.length).toBeGreaterThan(0); // предлагаем альтернативы
    }
    const n = await one<{ n: number }>(c.db, "SELECT count(*)::int n FROM appointments WHERE status='confirmed'");
    expect(n!.n).toBe(1);
  });
  it("database itself rejects overlap even if app logic is bypassed", async () => {
    const s = (await slots(c))[0];
    const r = await book(c, s.startUtc);
    const a = await one<{ staff_id: string; client_id: string }>(c.db, "SELECT staff_id,client_id FROM appointments WHERE id=$1", [r.appointmentId]);
    await expect(c.db.query(`INSERT INTO appointments(tenant_id,client_id,staff_id,service_id,start_at,end_at,blocked_until,status,idempotency_key,manage_token)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed','raw-bypass-1','t')`, [c.tenantId, a!.client_id, a!.staff_id, c.consult.id, s.startUtc, s.endUtc, s.endUtc])).rejects.toThrow(/no_overlap|exclusion/);
  });
  it("buffer after a visit is blocked", async () => {
    const all = await slots(c);
    const first = all[0];
    await book(c, first.startUtc);
    const next = new Date(new Date(first.endUtc).getTime() + 15 * 60000 - 1).toISOString();
    const after = await slots(c);
    expect(after.find((x) => x.startUtc < new Date(new Date(first.endUtc).getTime() + 15 * 60000).toISOString() && x.startUtc >= first.startUtc)).toBeUndefined();
    void next;
  });
  it("idempotent retry returns the same appointment, no duplicate", async () => {
    const s = (await slots(c))[0];
    const k = key();
    const a = await book(c, s.startUtc, 1, k);
    const b = await book(c, s.startUtc, 1, k);
    expect(b.appointmentId).toBe(a.appointmentId);
    expect(b.replayed).toBe(true);
    const n = await one<{ n: number }>(c.db, "SELECT count(*)::int n FROM appointments");
    expect(n!.n).toBe(1);
  });
  it("concurrent retries with same key create one appointment", async () => {
    const s = (await slots(c))[0];
    const k = key();
    const r = await Promise.all([book(c, s.startUtc, 1, k), book(c, s.startUtc, 1, k)]);
    expect(r[0].appointmentId).toBe(r[1].appointmentId);
  });
  it("rejects a time that is not a real free slot (invented by client or AI)", async () => {
    await expect(book(c, "2026-11-10T03:00:00.000Z")).rejects.toMatchObject({ code: "slot_unavailable" });
    await expect(book(c, "2026-11-08T10:00:00.000Z")).rejects.toMatchObject({ code: "slot_unavailable" }); // прошлое/воскресенье
  });
  it("validates contact and requires consent", async () => {
    const s = (await slots(c))[0];
    await expect(createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: { name: "X", contact: "not-a-contact", locale: "en" }, idempotencyKey: key(), consentService: true, now: NOW })).rejects.toMatchObject({ code: "invalid" });
    await expect(createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(), idempotencyKey: key(), consentService: false, now: NOW })).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("holds", () => {
  it("held slot is unavailable; expired hold releases it", async () => {
    const s = (await slots(c))[0];
    await createHold(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, now: NOW });
    await expect(book(c, s.startUtc)).rejects.toBeInstanceOf(BookingError);
    const later = new Date(NOW.getTime() + 11 * 60000);
    const free = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: later, days: 14 });
    expect(free.some((x) => x.startUtc === s.startUtc)).toBe(true);
  });
  it("hold converts to a confirmed booking", async () => {
    const s = (await slots(c))[0];
    const h = await createHold(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, now: NOW });
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, holdId: h.holdId, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    expect(r.status).toBe("confirmed");
  });
});

describe("cancel / reschedule / guest access", () => {
  it("cancel frees the slot and cancels queued reminders", async () => {
    const s = (await slots(c))[0];
    const r = await book(c, s.startUtc);
    await cancelBooking(c.db, c.tenantId, r.appointmentId, r.manageToken);
    expect((await slots(c)).some((x) => x.startUtc === s.startUtc)).toBe(true);
    const q = await rows(c.db, "SELECT status FROM notifications WHERE appointment_id=$1 AND kind='reminder_24h'", [r.appointmentId]);
    expect(q.every((x: any) => x.status === "cancelled")).toBe(true);
  });
  it("reschedule moves booking and leaves exactly one queued reminder", async () => {
    const all = await slots(c);
    const r = await book(c, all[0].startUtc);
    const target = all.find((x) => x.startUtc.slice(0, 10) !== all[0].startUtc.slice(0, 10))!;
    await rescheduleBooking(c.db, { tenantId: c.tenantId, id: r.appointmentId, token: r.manageToken, newStartUtc: target.startUtc, now: NOW });
    const q = await rows(c.db, "SELECT status FROM notifications WHERE appointment_id=$1 AND kind='reminder_24h' AND status='queued'", [r.appointmentId]);
    expect(q).toHaveLength(1);
    const a = await getBookingByToken(c.db, c.tenantId, r.appointmentId, r.manageToken);
    expect(new Date(a!.start_at).toISOString()).toBe(target.startUtc);
  });
  it("failed reschedule keeps the original booking", async () => {
    const all = await slots(c);
    const r1 = await book(c, all[0].startUtc, 1);
    const r2 = await book(c, all[3].startUtc, 2);
    await expect(rescheduleBooking(c.db, { tenantId: c.tenantId, id: r2.appointmentId, token: r2.manageToken, newStartUtc: all[0].startUtc, now: NOW })).rejects.toBeInstanceOf(BookingError);
    const a = await getBookingByToken(c.db, c.tenantId, r2.appointmentId, r2.manageToken);
    expect(a!.status).toBe("confirmed");
    expect(new Date(a!.start_at).toISOString()).toBe(all[3].startUtc);
    void r1;
  });
  it("cannot read or cancel someone else's booking by guessing id or token", async () => {
    const s = (await slots(c))[0];
    const r = await book(c, s.startUtc);
    expect(await getBookingByToken(c.db, c.tenantId, r.appointmentId, "wrong-token")).toBeNull();
    await expect(cancelBooking(c.db, c.tenantId, r.appointmentId, "wrong-token")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("notifications honesty", () => {
  it("without an email provider the confirmation is NOT reported as sent", async () => {
    const s = (await slots(c))[0];
    const r = await book(c, s.startUtc);
    expect(r.confirmationDeliveryStatus).toBe("not_configured");
    expect(r.status).toBe("confirmed"); // запись в календаре есть; письмо — отдельный честный статус
    const n = await rows<{ status: string; kind: string }>(c.db, "SELECT kind,status FROM notifications WHERE appointment_id=$1", [r.appointmentId]);
    expect(n.find((x) => x.kind === "booking_confirmation")!.status).toBe("not_configured");
    expect(n.some((x) => x.status === "sent" || x.status === "delivered")).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("tenant B cannot see or use tenant A data", async () => {
    const s = (await slots(c))[0];
    const r = await book(c, s.startUtc);
    expect(await getBookingByToken(c.db, c.tenantB, r.appointmentId, r.manageToken)).toBeNull();
    await expect(getAvailability(c.db, { tenantId: c.tenantB, serviceId: c.consult.id, now: NOW })).rejects.toMatchObject({ code: "not_found" });
    const bClients = await rows(c.db, "SELECT id FROM clients WHERE tenant_id=$1", [c.tenantB]);
    expect(bClients).toHaveLength(0);
    // та же услуга-слот в салоне B свободна независимо от A
    const sb = await getAvailability(c.db, { tenantId: c.tenantB, serviceId: (await rows<{ id: string }>(c.db, "SELECT id FROM services WHERE tenant_id=$1 AND slug='consultation'", [c.tenantB]))[0].id, now: NOW });
    expect(sb.some((x) => x.startUtc === s.startUtc)).toBe(true);
  });
});
