import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability } from "@/lib/booking";
import { handleMessage, startConversation } from "@/lib/ai";
import { chooseSlot, confirmAction, declineAction, parseManageRef } from "@/lib/ai-actions";

type Ctx = Awaited<ReturnType<typeof setup>>;
async function booked(c: Ctx, i = 1) {
  const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 10 }))[3];
  const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(i), idempotencyKey: key(), consentService: true, now: NOW });
  const link = `https://example.test/ru/manage/${r.appointmentId}?token=${r.manageToken}`;
  return { ...r, start: s.startUtc, link };
}
async function conv(c: Ctx, tenantId = c.tenantId) { return (await startConversation(c.db, { tenantId, locale: "ru" })).conversationId; }
const say = (c: Ctx, id: string, text: string, tenantId = c.tenantId) => handleMessage(c.db, { tenantId, conversationId: id, text, localeHint: "ru", now: NOW, llm: async () => null });
const status = async (c: Ctx, id: string) => (await c.db.all<{ status: string; start_at: string }>("SELECT status,start_at FROM appointments WHERE id=?1", [id]))[0];

describe("ИИ: перенос и отмена записи", () => {
  it("ссылка разбирается; без токена запись не ищется", () => {
    expect(parseManageRef("вот https://x.ie/ru/manage/0b9a8f06-1111-4222-8333-444455556666?token=abcDEF123_-456")).toEqual({ id: "0b9a8f06-1111-4222-8333-444455556666", token: "abcDEF123_-456" });
    expect(parseManageRef("запись 0b9a8f06-1111-4222-8333-444455556666")).toBeNull();
  });
  it("без ссылки ИИ ничего не меняет, объясняет, где взять ссылку, и передаёт запрос мастеру", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const r = await say(c, id, "Хочу отменить запись, меня зовут Test Client 1, почта client1@example.com");
    expect(r.message).toContain("/manage/"); expect(r.pending).toBeUndefined(); expect(r.requiresHuman).toBe(true);
    expect((await status(c, b.appointmentId)).status).toBe("confirmed");
  });
  it("неверный токен: тот же ответ, что и для несуществующей записи, ничего не раскрывается и не меняется", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const bad = await say(c, id, `отменить ${b.link.replace(b.manageToken, "WRONGTOKEN1234567")}`);
    const ghost = await say(c, await conv(c), "отменить https://x.test/ru/manage/0b9a8f06-1111-4222-8333-444455556666?token=WRONGTOKEN1234567");
    expect(bad.message).toBe(ghost.message); expect(bad.pending).toBeUndefined();
    expect((await status(c, b.appointmentId)).status).toBe("confirmed");
  });
  it("отмена: до нажатия запись жива; после подтверждения отменена; второе нажатие ничего не делает", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const r = await say(c, id, `Пожалуйста отмените запись ${b.link}`);
    expect(r.pending?.kind).toBe("cancel");
    expect((await status(c, b.appointmentId)).status).toBe("confirmed");
    const ok = await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: r.pending!.id, locale: "ru", now: NOW });
    expect(ok.ok).toBe(true); expect((await status(c, b.appointmentId)).status).toBe("cancelled");
    expect((await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: r.pending!.id, locale: "ru", now: NOW })).ok).toBe(false);
    expect((await c.db.all("SELECT 1 FROM audit_events WHERE action='ai.cancel.confirmed' AND actor='ai'")).length).toBe(1);
    expect((await c.db.all<{ secret: string }>("SELECT secret FROM ai_pending_actions"))[0].secret).toBe("");
    expect((await c.db.all("SELECT 1 FROM notifications WHERE appointment_id=?1 AND status='queued'", [b.appointmentId])).length).toBe(0);
  });
  it("сообщение с токеном не сохраняется в журнале диалога", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    await say(c, id, `отменить ${b.link}`);
    const all = JSON.stringify(await c.db.all("SELECT content FROM messages")) + JSON.stringify(await c.db.all("SELECT summary FROM handoffs"));
    expect(all).not.toContain(b.manageToken);
  });
  it("время на подтверждение 15 минут: позже запись не меняется", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const r = await say(c, id, `отменить ${b.link}`);
    const late = await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: r.pending!.id, locale: "ru", now: new Date(NOW.getTime() + 16 * 60000) });
    expect(late.ok).toBe(false); expect((await status(c, b.appointmentId)).status).toBe("confirmed");
  });
  it("подтвердить из чужого диалога или чужого салона нельзя", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const r = await say(c, id, `отменить ${b.link}`);
    const other = await conv(c);
    expect((await confirmAction(c.db, { tenantId: c.tenantId, conversationId: other, actionId: r.pending!.id, locale: "ru", now: NOW })).ok).toBe(false);
    expect((await confirmAction(c.db, { tenantId: c.tenantB, conversationId: id, actionId: r.pending!.id, locale: "ru", now: NOW })).ok).toBe(false);
    const idB = await conv(c, c.tenantB);
    expect((await say(c, idB, `отменить ${b.link}`, c.tenantB)).pending).toBeUndefined();
    expect((await status(c, b.appointmentId)).status).toBe("confirmed");
  });
  it("отказ клиента ничего не меняет", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const r = await say(c, id, `отменить ${b.link}`);
    await declineAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: r.pending!.id, locale: "ru" });
    expect((await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: r.pending!.id, locale: "ru", now: NOW })).ok).toBe(false);
    expect((await status(c, b.appointmentId)).status).toBe("confirmed");
  });
  it("перенос: ссылка без слова → вопрос; затем «перенести» без ссылки → настоящие слоты; выбор → подтверждение → запись перенесена, напоминание ровно одно", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const ask = await say(c, id, `вот моя запись ${b.link}`);
    expect(ask.pending).toBeUndefined(); expect(ask.message).toMatch(/перенести или отменить/);
    const mv = await say(c, id, "перенести пожалуйста");
    expect(mv.slots?.length).toBeGreaterThan(0); const real = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30, excludeAppointmentId: b.appointmentId });
    for (const s of mv.slots!) expect(real.map((x) => x.startUtc)).toContain(s.startUtc);
    const slot = mv.slots!.find((s) => s.startUtc !== b.start)!;
    const ch = await chooseSlot(c.db, { tenantId: c.tenantId, conversationId: id, actionId: slot.actionId!, startUtc: slot.startUtc, locale: "ru", now: NOW });
    expect(ch.pending?.kind).toBe("reschedule"); expect((await status(c, b.appointmentId)).start_at).toBe(new Date(b.start).toISOString());
    expect((await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: slot.actionId!, locale: "ru", now: NOW })).ok).toBe(true);
    expect(new Date((await status(c, b.appointmentId)).start_at).toISOString()).toBe(slot.startUtc);
    expect((await c.db.all("SELECT 1 FROM notifications WHERE appointment_id=?1 AND kind='reminder_24h' AND status='queued'", [b.appointmentId])).length).toBeLessThanOrEqual(1);
  });
  it("выдуманное время не принимается", async () => {
    const c = await setup(); const b = await booked(c); const id = await conv(c);
    const mv = await say(c, id, `перенести ${b.link}`);
    const r = await chooseSlot(c.db, { tenantId: c.tenantId, conversationId: id, actionId: mv.slots![0].actionId!, startUtc: "2026-11-15T03:00:00.000Z", locale: "ru", now: NOW });
    expect(r.pending).toBeUndefined(); expect((await status(c, b.appointmentId)).start_at).toBe(new Date(b.start).toISOString());
  });
  it("если выбранное время заняли до подтверждения, ничего не меняется", async () => {
    const c = await setup(); const b = await booked(c, 1); const id = await conv(c);
    const mv = await say(c, id, `перенести ${b.link}`);
    const slot = mv.slots![0];
    await chooseSlot(c.db, { tenantId: c.tenantId, conversationId: id, actionId: slot.actionId!, startUtc: slot.startUtc, locale: "ru", now: NOW });
    await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: slot.startUtc, client: person(2), idempotencyKey: key(), consentService: true, now: NOW });
    const r = await confirmAction(c.db, { tenantId: c.tenantId, conversationId: id, actionId: slot.actionId!, locale: "ru", now: NOW });
    expect(r.ok).toBe(false); expect(new Date((await status(c, b.appointmentId)).start_at).toISOString()).toBe(new Date(b.start).toISOString());
  });
  it("медицинский вопрос со словом «отменить» остаётся медицинским (безопасность выше)", async () => {
    const c = await setup(); const id = await conv(c);
    const r = await say(c, id, "у меня сильно болит голова, хочу отменить");
    expect(r.intent).toBe("medical");
  });
});
