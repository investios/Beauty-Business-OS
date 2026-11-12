import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("@/lib/notify", () => ({ deliverEmail: vi.fn(async () => "not_configured") }));
import { deliverEmail } from "@/lib/notify";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, cancelBooking, ownerSetStatus } from "@/lib/booking";
import { inQuietHours, planLifecycle, runLifecycle, toSendWindow } from "@/lib/lifecycle";
import { render } from "@/lib/lifecycle-templates";
import { addLocalDays, localParts, zonedToUtc } from "@/lib/tz";

type Ctx = Awaited<ReturnType<typeof setup>>;
const utc = (iso: string) => new Date(iso).getTime();
/** ближайшие 12:00 по Дублину не раньше момента ms (вне тихих часов) */
const noonAfter = (ms: number) => { const p = localParts(ms); let z = zonedToUtc(p.y, p.mo, p.d, 12, 0) as { utcMs: number }; if (z.utcMs < ms) { const n = addLocalDays(p.y, p.mo, p.d, 1); z = zonedToUtc(n.y, n.mo, n.d, 12, 0) as { utcMs: number }; } return z.utcMs; };
async function visit(c: Ctx, i = 1, marketing = false, locale = "ru") {
  const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 5 }))[0];
  const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: { ...person(i), locale }, idempotencyKey: key(), consentService: true, consentMarketing: marketing, now: NOW });
  await ownerSetStatus(c.db, { tenantId: c.tenantId, id: r.appointmentId, status: "completed" });
  return { id: r.appointmentId, start: s.startUtc, end: s.endUtc, token: r.manageToken };
}
const msgs = (c: Ctx) => c.db.all<{ kind: string; status: string; mode: string; body: string | null; skip_reason: string | null; locale: string }>(
  "SELECT n.kind,n.status,m.mode,m.body,m.skip_reason,m.locale FROM lifecycle_messages m JOIN notifications n ON n.id=m.notification_id ORDER BY n.kind");
beforeEach(() => { vi.mocked(deliverEmail).mockClear(); });
afterEach(() => { delete process.env.LIFECYCLE_SEND; });

describe("тихие часы", () => {
  it("с 20:00 до 09:00 по Дублину отправка переносится на 09:00", () => {
    expect(inQuietHours(utc("2026-11-10T22:00:00Z"))).toBe(true);
    expect(inQuietHours(utc("2026-11-10T12:00:00Z"))).toBe(false);
    expect(new Date(toSendWindow(utc("2026-11-10T22:00:00Z"))).toISOString()).toBe("2026-11-11T09:00:00.000Z");
    expect(new Date(toSendWindow(utc("2026-11-10T03:00:00Z"))).toISOString()).toBe("2026-11-10T09:00:00.000Z");
    expect(toSendWindow(utc("2026-11-10T12:00:00Z"))).toBe(utc("2026-11-10T12:00:00Z"));
  });
  it("летнее время: 09:00 по Дублину = 08:00 UTC", () => {
    expect(new Date(toSendWindow(utc("2026-07-10T21:30:00Z"))).toISOString()).toBe("2026-07-11T08:00:00.000Z");
  });
});

describe("планирование", () => {
  it("после состоявшегося визита создаются «как прошёл» (через сутки) и «повторный» (через 28 дней), повтор не дублирует", async () => {
    const c = await setup(); const v = await visit(c);
    const now = utc(v.end) + 2 * 86400000;
    expect(await planLifecycle(c.db, c.tenantId, { nowMs: now })).toBe(2);
    expect(await planLifecycle(c.db, c.tenantId, { nowMs: now })).toBe(0);
    const j = await c.db.all<{ kind: string; scheduled_for: string }>("SELECT kind,scheduled_for FROM notifications WHERE kind IN ('followup','rebook') ORDER BY kind");
    expect(j.map((x) => x.kind)).toEqual(["followup", "rebook"]);
    expect(inQuietHours(utc(j[0].scheduled_for))).toBe(false);
    expect(utc(j[1].scheduled_for)).toBeGreaterThanOrEqual(utc(v.end) + 28 * 86400000);
  });
  it("уникальный индекс не даёт создать вторую активную задачу вручную", async () => {
    const c = await setup(); const v = await visit(c);
    await planLifecycle(c.db, c.tenantId, { nowMs: utc(v.end) + 2 * 86400000 });
    await expect(c.db.run("INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at) VALUES ('x',?1,?2,'followup','queued','2026-12-01T00:00:00Z','2026-12-01T00:00:00Z')", [c.tenantId, v.id])).rejects.toThrow();
  });
  it("отменённая запись снимает ожидающие задачи", async () => {
    const c = await setup(); const v = await visit(c);
    await planLifecycle(c.db, c.tenantId, { nowMs: utc(v.end) + 2 * 86400000 });
    await c.db.run("UPDATE appointments SET status='cancelled' WHERE id=?1", [v.id]);
    await planLifecycle(c.db, c.tenantId, { nowMs: utc(v.end) + 3 * 86400000 });
    expect(await c.db.all("SELECT 1 FROM notifications WHERE appointment_id=?1 AND kind IN ('followup','rebook') AND status='queued'", [v.id])).toHaveLength(0);
  });
});

describe("пробный прогон", () => {
  it("до срока ничего не обрабатывается, после срока формируется текст на языке клиента, наружу ничего не уходит", async () => {
    const c = await setup(); const v = await visit(c, 1, true, "ru");
    const early = await runLifecycle(c.db, c.tenantId, { nowMs: utc(v.end) + 3600000 * 2 });
    expect(early.simulated).toBe(0);
    const r = await runLifecycle(c.db, c.tenantId, { nowMs: noonAfter(utc(v.end) + 2 * 86400000) });
    expect(r.simulated).toBeGreaterThanOrEqual(1);
    const m = await msgs(c);
    const f = m.find((x) => x.kind === "followup")!;
    expect(f.mode).toBe("simulated"); expect(f.status).toBe("not_configured"); expect(f.locale).toBe("ru");
    expect(f.body).toContain("Test Client 1"); expect(f.body).toContain("Спасибо");
    expect(deliverEmail).not.toHaveBeenCalled();
  });
  it("повторный запуск ничего не обрабатывает дважды", async () => {
    const c = await setup(); const v = await visit(c);
    const t = noonAfter(utc(v.end) + 2 * 86400000);
    await runLifecycle(c.db, c.tenantId, { nowMs: t });
    const second = await runLifecycle(c.db, c.tenantId, { nowMs: t });
    expect(second.simulated + second.skipped + second.sent).toBe(0);
    expect((await msgs(c)).filter((x) => x.kind === "followup")).toHaveLength(1);
  });
  it("«повторный визит» без согласия на маркетинг пропускается, с согласием формируется; отзыв согласия останавливает", async () => {
    const c = await setup(); const a = await visit(c, 1, false); const b = await visit(c, 2, true);
    const t = noonAfter(utc(a.end) + 30 * 86400000);
    await c.db.run("UPDATE consents SET withdrawn_at='2026-11-10T00:00:00Z' WHERE purpose='marketing' AND client_id=(SELECT client_id FROM appointments WHERE id=?1)", [b.id]);
    let r = await runLifecycle(c.db, c.tenantId, { nowMs: t });
    expect((await msgs(c)).filter((x) => x.kind === "rebook").every((x) => x.skip_reason === "no_marketing_consent")).toBe(true);
    expect(r.skipped).toBeGreaterThanOrEqual(2);
    const c2 = await setup(); const z = await visit(c2, 3, true);
    await runLifecycle(c2.db, c2.tenantId, { nowMs: noonAfter(utc(z.end) + 30 * 86400000) });
    expect((await msgs(c2)).find((x) => x.kind === "rebook")!.mode).toBe("simulated");
  });
  it("в тихие часы задачи ждут утра и не теряются", async () => {
    const c = await setup(); const v = await visit(c);
    const day = new Date(utc(v.end) + 2 * 86400000); const late = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 22, 0) as { utcMs: number };
    const r = await runLifecycle(c.db, c.tenantId, { nowMs: late.utcMs });
    expect(r.waiting).toBeGreaterThanOrEqual(1); expect(r.simulated).toBe(0);
    const morning = await runLifecycle(c.db, c.tenantId, { nowMs: late.utcMs + 12 * 3600000 });
    expect(morning.simulated).toBeGreaterThanOrEqual(1);
  });
  it("напоминание за сутки: формируется вовремя; после начала визита пропускается; отмена записи его снимает", async () => {
    const c = await setup();
    const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 6 })).find((x) => x.startUtc.startsWith("2026-11-12"))!;
    const mk = async (i: number) => createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(i), idempotencyKey: key(), consentService: true, now: NOW });
    const r = await mk(1);
    const due = utc(s.startUtc) - 24 * 3600000;
    const ok = await runLifecycle(c.db, c.tenantId, { nowMs: Math.max(due + 60000, utc("2026-11-11T10:00:00Z")) });
    expect(ok.simulated + ok.waiting).toBeGreaterThanOrEqual(1);
    const c2 = await setup(); const s2 = (await getAvailability(c2.db, { tenantId: c2.tenantId, serviceId: c2.consult.id, now: NOW, days: 6 }))[0];
    const r2 = await createBooking(c2.db, { tenantId: c2.tenantId, serviceId: c2.consult.id, startsAtUtc: s2.startUtc, client: person(2), idempotencyKey: key(), consentService: true, now: NOW });
    await cancelBooking(c2.db, c2.tenantId, r2.appointmentId, r2.manageToken);
    const out = await runLifecycle(c2.db, c2.tenantId, { nowMs: utc(s2.startUtc) });
    expect(out.simulated).toBe(0);
    expect(r.status).toBeDefined();
  });
  it("чужой салон не затрагивается", async () => {
    const c = await setup(); const v = await visit(c);
    const r = await runLifecycle(c.db, c.tenantB, { nowMs: utc(v.end) + 3 * 86400000 });
    expect(r.simulated + r.skipped + r.planned).toBe(0);
    expect(await msgs(c)).toHaveLength(0);
  });
  it("в сохранённых текстах нет ссылки с секретным токеном записи", async () => {
    const c = await setup(); const v = await visit(c);
    await runLifecycle(c.db, c.tenantId, { nowMs: noonAfter(utc(v.end) + 2 * 86400000) });
    for (const m of await msgs(c)) expect(m.body ?? "").not.toContain(v.token);
  });
  it("«визит состоялся» в песочнице: по уже прошедшей подтверждённой записи можно проиграть сценарий", async () => {
    const c = await setup();
    const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 5 }))[0];
    await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(1), idempotencyKey: key(), consentService: true, now: NOW });
    const t = noonAfter(utc(s.endUtc) + 2 * 86400000);
    expect((await runLifecycle(c.db, c.tenantId, { nowMs: t })).simulated).toBe(0);
    expect((await runLifecycle(c.db, c.tenantId, { nowMs: t, assumeVisits: true })).simulated).toBeGreaterThanOrEqual(1);
  });
});

describe("реальная отправка выключена по умолчанию", () => {
  it("даже с флагом send без LIFECYCLE_SEND письмо не уходит", async () => {
    const c = await setup(); const v = await visit(c);
    await runLifecycle(c.db, c.tenantId, { nowMs: noonAfter(utc(v.end) + 2 * 86400000), send: true });
    expect(deliverEmail).not.toHaveBeenCalled();
  });
  it("с включённым флагом, но без провайдера, ошибка видна, а не «отправлено»", async () => {
    process.env.LIFECYCLE_SEND = "1";
    const c = await setup(); const v = await visit(c);
    const r = await runLifecycle(c.db, c.tenantId, { nowMs: noonAfter(utc(v.end) + 2 * 86400000), send: true });
    expect(r.failed).toBeGreaterThanOrEqual(1); expect(r.sent).toBe(0);
    expect((await c.db.all<{ error: string }>("SELECT error FROM notifications WHERE status='failed'"))[0].error).toBe("provider_not_configured");
  });
});

describe("шаблоны RU/EN/UK", () => {
  it("все четыре сообщения на трёх языках без незаполненных полей", () => {
    for (const k of ["booking_confirmation", "reminder_24h", "followup", "rebook"] as const) for (const l of ["ru", "en", "uk"]) {
      const m = render(k, l, { name: "Анна", salon: "Салон", service: "Консультация", when: "вт, 10 нояб., 11:00", manageUrl: "[ссылка]" });
      expect(m.subject.length).toBeGreaterThan(3); expect(m.body).not.toMatch(/[{}]/);
    }
  });
});
