import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, cancelBooking, getAvailability, rescheduleBooking, ownerRescheduleBooking } from "@/lib/booking";
import { DEFAULT_POLICIES, getPolicies, policyHistory, setPolicy, validatePolicy } from "@/lib/policies";
import { planReminders } from "@/lib/reminders";

const book = async (c: Awaited<ReturnType<typeof setup>>, startUtc: string, now = NOW) =>
  createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: startUtc, client: person(), idempotencyKey: key(), consentService: true, now });
const slotAfter = async (c: Awaited<ReturnType<typeof setup>>, afterH: number, now = NOW) =>
  (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now, days: 40 })).find((s) => new Date(s.startUtc).getTime() > now.getTime() + afterH * 3600000)!;

describe("правила бизнеса с версиями", () => {
  it("значения по умолчанию из ТЗ", async () => {
    const c = await setup(); const p = await getPolicies(c.db, c.tenantId);
    expect(p.persisted).toBe(true);
    expect(p.values).toEqual(DEFAULT_POLICIES);
    expect(p.values.cancel_limit_hours).toBe(12);
    expect(p.values.remind_morning).toBe(0); expect(p.values.remind_one_hour).toBe(0);
  });
  it("изменение пишет новую версию и журнал; то же значение не создаёт версию; недопустимое отклоняется", async () => {
    const c = await setup();
    expect((await setPolicy(c.db, c.tenantId, "cancel_limit_hours", 24, "owner")).ok).toBe(true);
    expect((await setPolicy(c.db, c.tenantId, "cancel_limit_hours", 24, "owner")).reason).toBe("same");
    expect((await setPolicy(c.db, c.tenantId, "cancel_limit_hours", -3, "owner")).reason).toBe("invalid");
    expect((await setPolicy(c.db, c.tenantId, "remind_morning", 5, "owner")).reason).toBe("invalid");
    await setPolicy(c.db, c.tenantId, "cancel_limit_hours", 6, "owner");
    expect((await getPolicies(c.db, c.tenantId)).values.cancel_limit_hours).toBe(6);
    const h = await policyHistory(c.db, c.tenantId);
    expect(h.map((x) => x.version)).toEqual([2, 1]);
    expect(await c.db.all("SELECT 1 FROM audit_events WHERE action='policy.change'")).toHaveLength(2);
  });
  it("правила разных салонов не смешиваются", async () => {
    const c = await setup();
    await setPolicy(c.db, c.tenantId, "cancel_limit_hours", 48, "owner");
    expect((await getPolicies(c.db, c.tenantB)).values.cancel_limit_hours).toBe(12);
  });
  it("без таблицы (миграция 0009 не применена) работают значения по умолчанию", async () => {
    const c = await setup(); await c.db.run("DROP TABLE policies");
    const p = await getPolicies(c.db, c.tenantId);
    expect(p.persisted).toBe(false); expect(p.values.cancel_limit_hours).toBe(12);
    const s = await slotAfter(c, 48);
    expect((await book(c, s.startUtc)).status).toBe("confirmed"); // запись не ломается
  });
  it("validatePolicy", () => { expect(validatePolicy("cancel_limit_hours", "12")).toBe(12); expect(validatePolicy("cancel_limit_hours", 1.5)).toBeNull(); expect(validatePolicy("remind_two_days", true)).toBe(1); });
});

describe("напоминания по ТЗ v2.0", () => {
  const P = { ...DEFAULT_POLICIES };
  it("вечером накануне в 19:00 по Дублину; летом это 18:00 UTC", () => {
    const r = planReminders(new Date("2026-11-12T10:00:00Z"), new Date("2026-11-09T08:00:00Z"), P);
    expect(r.find((x) => x.kind === "reminder_24h")!.at.toISOString()).toBe("2026-11-11T19:00:00.000Z");
    const s = planReminders(new Date("2026-07-15T10:00:00Z"), new Date("2026-07-10T08:00:00Z"), P);
    expect(s.find((x) => x.kind === "reminder_24h")!.at.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });
  it("за 2 дня только при записи за неделю и больше", () => {
    const early = planReminders(new Date("2026-11-20T10:00:00Z"), new Date("2026-11-09T08:00:00Z"), P).map((x) => x.kind);
    expect(early).toContain("reminder_2d");
    const late = planReminders(new Date("2026-11-13T10:00:00Z"), new Date("2026-11-09T08:00:00Z"), P).map((x) => x.kind);
    expect(late).not.toContain("reminder_2d");
  });
  it("утреннее и за час выключены по умолчанию и включаются настройкой", () => {
    const start = new Date("2026-11-12T14:00:00Z"), now = new Date("2026-11-09T08:00:00Z");
    expect(planReminders(start, now, P).map((x) => x.kind)).toEqual(["reminder_24h"]);
    const on = planReminders(start, now, { ...P, remind_morning: 1, remind_one_hour: 1 });
    expect(on.map((x) => x.kind).sort()).toEqual(["reminder_1h", "reminder_24h", "reminder_morning"]);
    expect(on.find((x) => x.kind === "reminder_1h")!.at.toISOString()).toBe("2026-11-12T13:00:00.000Z");
  });
  it("прошедшие моменты не ставятся: запись на завтра утром после 19:00 накануне", () => {
    expect(planReminders(new Date("2026-11-10T09:30:00Z"), new Date("2026-11-09T21:00:00Z"), P)).toHaveLength(0);
  });
  it("в очереди после записи лежат именно эти напоминания", async () => {
    const c = await setup(); const s = await slotAfter(c, 24 * 9);
    const r = await book(c, s.startUtc);
    const kinds = (await c.db.all<{ kind: string }>("SELECT kind FROM notifications WHERE appointment_id=?1 AND kind LIKE 'reminder%' ORDER BY kind", [r.appointmentId])).map((x) => x.kind);
    expect(kinds).toEqual(["reminder_24h", "reminder_2d"]);
  });
});

describe("лимит отмены и переноса клиентом", () => {
  it("раньше лимита клиент отменяет сам; позже нет, запись остаётся", async () => {
    const c = await setup();
    const far = await slotAfter(c, 48); const rFar = await book(c, far.startUtc);
    expect((await cancelBooking(c.db, c.tenantId, rFar.appointmentId, rFar.manageToken, NOW)).status).toBe("cancelled");
    const near = await slotAfter(c, 2); const rNear = await book(c, near.startUtc);
    await expect(cancelBooking(c.db, c.tenantId, rNear.appointmentId, rNear.manageToken, new Date(new Date(near.startUtc).getTime() - 3 * 3600000))).rejects.toMatchObject({ code: "too_late" });
    expect((await c.db.all<{ status: string }>("SELECT status FROM appointments WHERE id=?1", [rNear.appointmentId]))[0].status).toBe("confirmed");
  });
  it("перенос клиентом ближе лимита тоже закрыт, мастер переносит всегда", async () => {
    const c = await setup(); const near = await slotAfter(c, 2); const r = await book(c, near.startUtc);
    const now = new Date(new Date(near.startUtc).getTime() - 3 * 3600000);
    const other = await slotAfter(c, 72);
    await expect(rescheduleBooking(c.db, { tenantId: c.tenantId, id: r.appointmentId, token: r.manageToken, newStartUtc: other.startUtc, now })).rejects.toMatchObject({ code: "too_late" });
    await ownerRescheduleBooking(c.db, { tenantId: c.tenantId, id: r.appointmentId, newStartUtc: other.startUtc, now });
    expect((await c.db.all<{ start_at: string }>("SELECT start_at FROM appointments WHERE id=?1", [r.appointmentId]))[0].start_at).toBe(other.startUtc);
  });
  it("смена лимита не меняет условия уже созданной записи", async () => {
    const c = await setup(); const s = await slotAfter(c, 20); const r = await book(c, s.startUtc); // лимит 12 ч на момент записи
    await setPolicy(c.db, c.tenantId, "cancel_limit_hours", 48, "owner");
    const t = await c.db.all<{ cancel_limit_hours: number }>("SELECT cancel_limit_hours FROM appointment_terms WHERE appointment_id=?1", [r.appointmentId]);
    expect(t[0].cancel_limit_hours).toBe(12);
    const at = new Date(new Date(s.startUtc).getTime() - 20 * 3600000); // за 20 ч: по старому правилу можно, по новому нельзя
    expect((await cancelBooking(c.db, c.tenantId, r.appointmentId, r.manageToken, at)).status).toBe("cancelled");
  });
});
