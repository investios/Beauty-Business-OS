import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, ownerSetStatus, applyVipReserve } from "@/lib/booking";
import { adjust, balance, decideVipRequest, isVip, ledger, redeem, referralCode, requestVipUrgent, runLoyalty, setVip, vipRequests } from "@/lib/loyalty";
import { setPolicy } from "@/lib/policies";

type C = Awaited<ReturnType<typeof setup>>;
const visit = async (c: C, idx: number, who = person(), source?: Record<string, string>) => {
  const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 }))[idx];
  const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: who, idempotencyKey: key(), consentService: true, source, now: NOW });
  const clientId = (await c.db.all<{ id: string }>("SELECT client_id id FROM appointments WHERE id=?1", [r.appointmentId]))[0].id;
  return { id: r.appointmentId, clientId };
};
const done = (c: C, id: string) => ownerSetStatus(c.db, { tenantId: c.tenantId, id, status: "completed" });

describe("бонусный журнал", () => {
  it("начисление за визит идемпотентно; баланс — сумма целых центов; списание не больше баланса", async () => {
    const c = await setup(); const v = await visit(c, 3); await done(c, v.id);
    const a = await runLoyalty(c.db, c.tenantId, NOW.getTime() + 5 * 86400000);
    expect(a.accrued).toBe(1); expect((await runLoyalty(c.db, c.tenantId, NOW.getTime() + 5 * 86400000)).accrued).toBe(0);
    expect(await balance(c.db, c.tenantId, v.clientId)).toBe(300);
    expect(await redeem(c.db, c.tenantId, v.clientId, 500)).toBe("insufficient");
    expect(await redeem(c.db, c.tenantId, v.clientId, 1.5)).toBe("invalid");
    expect(await redeem(c.db, c.tenantId, v.clientId, 0)).toBe("invalid");
    expect(await redeem(c.db, c.tenantId, v.clientId, 100)).toBe("ok");
    expect(await adjust(c.db, c.tenantId, v.clientId, 0.1 + 0.2, "float")).toBe("invalid");
    expect(await adjust(c.db, c.tenantId, v.clientId, 50, "")).toBe("invalid");
    expect(await adjust(c.db, c.tenantId, v.clientId, 50, "компенсация")).toBe("ok");
    expect(await adjust(c.db, c.tenantId, v.clientId, -1000, "лишнее")).toBe("insufficient");
    expect(await balance(c.db, c.tenantId, v.clientId)).toBe(250);
    expect((await ledger(c.db, c.tenantId, v.clientId)).every((l) => l.is_test === 1)).toBe(true);
    expect(await balance(c.db, c.tenantB, v.clientId)).toBe(0);
    expect(await redeem(c.db, c.tenantB, v.clientId, 10)).toBe("insufficient");
  });
  it("размер бонуса меняется в настройках; 0 выключает начисление", async () => {
    const c = await setup(); await setPolicy(c.db, c.tenantId, "loyalty_visit_bonus_cents", 0, "owner");
    const v = await visit(c, 3); await done(c, v.id);
    expect((await runLoyalty(c.db, c.tenantId, NOW.getTime() + 5 * 86400000)).accrued).toBe(0);
  });
});
describe("рефералы", () => {
  it("награда только после реального визита друга; повтор не дублирует; себя и дубли контакта не приглашают", async () => {
    const c = await setup(); const t = NOW.getTime() + 5 * 86400000;
    const a = await visit(c, 3, person(1)); await done(c, a.id);
    const code = (await referralCode(c.db, c.tenantId, a.clientId))!;
    expect(code).toMatch(/^[A-Z2-9]{6}$/); expect(await referralCode(c.db, c.tenantId, a.clientId)).toBe(code);
    const f = await visit(c, 6, person(2), { ref: code });
    await runLoyalty(c.db, c.tenantId, t);
    expect((await c.db.all("SELECT 1 FROM referrals WHERE status='pending'")).length).toBe(1);
    const before = await balance(c.db, c.tenantId, a.clientId);
    expect((await runLoyalty(c.db, c.tenantId, t)).rewarded).toBe(0); // друг ещё не был на визите
    await done(c, f.id);
    expect((await runLoyalty(c.db, c.tenantId, t)).rewarded).toBe(1);
    expect(await balance(c.db, c.tenantId, a.clientId)).toBe(before + 1000);
    expect(await balance(c.db, c.tenantId, f.clientId)).toBe(300 + 500);
    expect((await runLoyalty(c.db, c.tenantId, t)).rewarded).toBe(0);
    expect(await balance(c.db, c.tenantId, a.clientId)).toBe(before + 1000);
  });
  it("приглашение самого себя и чужой код не работают", async () => {
    const c = await setup(); const a = await visit(c, 3, person(1));
    const code = (await referralCode(c.db, c.tenantId, a.clientId))!;
    await c.db.run("UPDATE appointments SET source=?2 WHERE id=?1", [a.id, JSON.stringify({ ref: code })]);
    const b = await visit(c, 6, person(2), { ref: "ZZZZZZ" });
    expect((await runLoyalty(c.db, c.tenantId, NOW.getTime())).linked).toBe(0); void b;
  });
});
describe("VIP", () => {
  it("статус и срочный план решает мастер; ИИ не может выдать VIP; чужой салон отклоняется", async () => {
    const c = await setup(); const v = await visit(c, 3);
    expect(await requestVipUrgent(c.db, c.tenantId, v.clientId, "срочно нужно завтра")).toBe(false);
    expect(await setVip(c.db, c.tenantB, v.clientId, true, "x")).toBe(false);
    expect(await setVip(c.db, c.tenantId, v.clientId, true, "постоянная клиентка")).toBe(true); expect(await isVip(c.db, c.tenantId, v.clientId)).toBe(true);
    expect(await requestVipUrgent(c.db, c.tenantId, v.clientId, "срочно")).toBe(true);
    expect(await requestVipUrgent(c.db, c.tenantId, v.clientId, "ещё раз")).toBe(true);
    const list = await vipRequests(c.db, c.tenantId); expect(list).toHaveLength(1);
    expect(await decideVipRequest(c.db, c.tenantB, list[0].id, true, "")).toBe(false);
    expect(await decideVipRequest(c.db, c.tenantId, list[0].id, true, "приходите в 9")).toBe(true);
    expect(await decideVipRequest(c.db, c.tenantId, list[0].id, false, "")).toBe(false);
  });
});
describe("резерв для VIP", () => {
  const mk = (day: string, n: number) => Array.from({ length: n }, (_, i) => ({ startUtc: `${day}T${String(8 + i).padStart(2, "0")}:00:00.000Z` }));
  it("скрывает последние окна дня на дальних датах и открывает их за 48 часов; выключен по умолчанию", () => {
    const now = new Date("2026-11-09T08:00:00Z").getTime();
    const far = mk("2026-11-20", 10), near = mk("2026-11-10", 10);
    const pol = { vip_reserve_pct: 10, vip_release_hours: 48 };
    expect(applyVipReserve(far, pol, now, "Europe/Dublin")).toHaveLength(9);
    expect(applyVipReserve(near, pol, now, "Europe/Dublin")).toHaveLength(10);
    expect(applyVipReserve(far, { ...pol, vip_reserve_pct: 0 }, now, "Europe/Dublin")).toHaveLength(10);
  });
  it("в реальной выдаче: резерв включён → публично меньше окон, мастеру (ignoreReserve) все", async () => {
    const c = await setup(); await setPolicy(c.db, c.tenantId, "vip_reserve_pct", 20, "owner");
    const pub = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 });
    const all = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30, ignoreReserve: true });
    expect(pub.length).toBeLessThan(all.length);
  });
});

import { handleMessage, startConversation } from "@/lib/ai";
describe("срочная запись VIP через ИИ", () => {
  it("VIP по ссылке записи: ИИ ничего не бронирует, создаёт запрос мастеру; обычному клиенту — обычный путь", async () => {
    const c = await setup(); const v = await visit(c, 3);
    const row = (await c.db.all<{ id: string; manage_token: string }>("SELECT id,manage_token FROM appointments WHERE id=?1", [v.id]))[0];
    const link = `https://example.test/ru/manage/${row.id}?token=${row.manage_token}`;
    const say = (id: string, text: string) => handleMessage(c.db, { tenantId: c.tenantId, conversationId: id, text, localeHint: "ru", now: NOW, llm: async () => null });
    const a = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    await say(a.conversationId, `моя запись ${link}`);
    const before = (await c.db.all("SELECT 1 FROM appointments")).length;
    expect((await say(a.conversationId, "Мне срочно нужно записаться на завтра")).message).not.toMatch(/Передал вашу срочную/);
    await setVip(c.db, c.tenantId, v.clientId, true, "");
    const r = await say(a.conversationId, "Мне срочно нужно записаться на завтра");
    expect(r.message).toMatch(/срочную просьбу/); expect(r.requiresHuman).toBe(true);
    expect((await vipRequests(c.db, c.tenantId)).length).toBe(1);
    expect((await c.db.all("SELECT 1 FROM appointments")).length).toBe(before);
  });
});
