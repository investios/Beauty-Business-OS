import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability } from "@/lib/booking";
import { handleMessage, startConversation } from "@/lib/ai";
import { toolAllowed, TOOLS } from "@/lib/ai-tools";

describe("реестр инструментов ИИ", () => {
  it("полномочия: auto — сам, confirm — только с подтверждением, master — никогда", () => {
    expect(toolAllowed("getAvailability")).toBe(true);
    expect(toolAllowed("changeBooking")).toBe(false); expect(toolAllowed("changeBooking", true)).toBe(true);
    for (const n of ["setDiscount", "setVipStatus", "changePrice", "medicalAdvice", "replyToClient"]) { expect(toolAllowed(n)).toBe(false); expect(toolAllowed(n, true)).toBe(false); }
    expect(toolAllowed("nonexistent", true)).toBe(false);
    expect(Object.keys(TOOLS).length).toBeGreaterThan(10);
  });
});
describe("узнавание клиента", () => {
  const book = async () => {
    const c = await setup();
    const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 }))[3];
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    return { c, link: `https://example.test/ru/manage/${r.appointmentId}?token=${r.manageToken}` };
  };
  const say = (c: Awaited<ReturnType<typeof setup>>, id: string, text: string) => handleMessage(c.db, { tenantId: c.tenantId, conversationId: id, text, localeHint: "ru", now: NOW, llm: async () => null });
  it("по ссылке записи ИИ узнаёт клиента, здоровается по имени один раз; без ссылки не узнаёт", async () => {
    const { c, link } = await book();
    const anon = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    const r0 = await say(c, anon.conversationId, "Здравствуйте, я Анна, у меня запись на завтра");
    expect(r0.message).not.toMatch(/Узнал вашу запись/);
    const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    const r1 = await say(c, id, `Хочу перенести ${link}`);
    expect(r1.message).toMatch(/Здравствуйте, .+! Узнал вашу запись/);
    const r2 = await say(c, id, "перенести пожалуйста");
    expect(r2.message).not.toMatch(/Узнал вашу запись/);
  });
  it("вопрос от узнанного клиента: мастеру уходит обращение, в карточке — заметка «От ИИ»", async () => {
    const { c, link } = await book();
    const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    await say(c, id, `вот моя запись ${link}`);
    const r = await say(c, id, "После процедуры болит голова");
    expect(r.requiresHuman).toBe(true);
    const notes = await c.db.all<{ body: string; author: string }>("SELECT body,author FROM client_notes WHERE tenant_id=?1", [c.tenantId]);
    expect(notes).toHaveLength(1); expect(notes[0].author).toBe("ai"); expect(notes[0].body).toMatch(/^От ИИ:/);
    expect((await c.db.all("SELECT 1 FROM audit_events WHERE action='ai.addAiNote'")).length).toBe(1);
  });
});
