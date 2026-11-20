import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { handleMessage, startConversation, detectLocale } from "@/lib/ai";
import { addToWaitlist } from "@/lib/waitlist";

const rowsOf = (c: Awaited<ReturnType<typeof setup>>, t = c.tenantId) => c.db.all<{ contact: string; consent_contact: number; status: string }>("SELECT contact,consent_contact,status FROM waitlist WHERE tenant_id=?1", [t]);
describe("лист ожидания из диалога с ИИ", () => {
  it("добавление, дубль, неверный контакт и изоляция салонов", async () => {
    const c = await setup(); const sid = c.consult.id;
    expect(await addToWaitlist(c.db, c.tenantId, { contact: "anna@example.test", serviceId: sid, now: NOW })).toBe("added");
    expect(await addToWaitlist(c.db, c.tenantId, { contact: " ANNA@example.test ", serviceId: sid, now: NOW })).toBe("exists");
    expect(await addToWaitlist(c.db, c.tenantId, { contact: "12", serviceId: sid, now: NOW })).toBe("invalid");
    expect(await addToWaitlist(c.db, c.tenantId, { contact: "bob@example.test", serviceId: null, now: NOW })).toBe("invalid");
    expect(await addToWaitlist(c.db, c.tenantB, { contact: "eve@example.test", serviceId: sid, now: NOW })).toBe("invalid"); // услуга чужого салона
    expect(await rowsOf(c)).toEqual([{ contact: "anna@example.test", consent_contact: 1, status: "waiting" }]);
  });
  it("контакт без слов не меняет язык диалога", () => {
    expect(detectLocale("anna@example.test", "ru")).toBe("ru");
    expect(detectLocale("Hello, how much is it?", "ru")).toBe("en");
  });
  it("нет времени → ИИ предлагает лист ожидания → контакт заносит клиента в список", async () => {
    const c = await setup(); await c.db.run("DELETE FROM availability_rules WHERE tenant_id=?1", [c.tenantId]);
    const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    const say = (text: string) => handleMessage(c.db, { tenantId: c.tenantId, conversationId: id, text, localeHint: "ru", now: NOW, llm: async () => null });
    const r = await say("Хочу записаться на консультацию");
    expect(r.message).toMatch(/лист ожидания/);
    const r2 = await say("anna@example.test");
    expect(r2.message).toMatch(/в листе ожидания/);
    expect((await rowsOf(c)).map((w) => w.contact)).toEqual(["anna@example.test"]);
  });
});
