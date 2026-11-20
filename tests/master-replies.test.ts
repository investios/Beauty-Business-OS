import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { handleMessage, startConversation } from "@/lib/ai";
import { masterRepliesSince, replyToHandoff } from "@/lib/master-replies";
import { setPolicy } from "@/lib/policies";

const ask = async (c: Awaited<ReturnType<typeof setup>>, id: string, text: string, tenantId = c.tenantId) =>
  handleMessage(c.db, { tenantId, conversationId: id, text, localeHint: "ru", now: NOW, llm: async () => null });

describe("вопросы мастеру и ответ клиенту", () => {
  it("ответ мастера возвращается в диалог, вопрос закрывается; чужой салон и пустой текст отклоняются", async () => {
    const c = await setup(); const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    const r = await ask(c, id, "Болит голова после наращивания, что делать?");
    expect(r.requiresHuman).toBe(true); const hid = r.handoffId!;
    expect(await replyToHandoff(c.db, c.tenantB, hid, "чужой", "owner")).toBe(false);
    expect(await replyToHandoff(c.db, c.tenantId, hid, "   ", "owner")).toBe(false);
    expect(await replyToHandoff(c.db, c.tenantId, hid, "Приходите завтра, посмотрю", "owner")).toBe(true);
    const rep = await masterRepliesSince(c.db, c.tenantId, id, "");
    expect(rep.map((x) => x.content)).toEqual(["Приходите завтра, посмотрю"]);
    expect((await c.db.all<{ status: string }>("SELECT status FROM handoffs WHERE id=?1", [hid]))[0].status).toBe("resolved");
    expect(await masterRepliesSince(c.db, c.tenantId, id, rep[0].created_at)).toEqual([]);
    expect(await masterRepliesSince(c.db, c.tenantB, id, "")).toEqual([]);
  });
  it("в ответах клиенту нет ничего, кроме ответов мастера", async () => {
    const c = await setup(); const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    await ask(c, id, "Сколько стоит наращивание?");
    expect(await masterRepliesSince(c.db, c.tenantId, id, "")).toEqual([]);
  });
  it("режим «мастер занят»: ИИ предупреждает только при передаче вопроса", async () => {
    const c = await setup(); await setPolicy(c.db, c.tenantId, "master_busy", 1, "owner");
    const a = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    expect((await ask(c, a.conversationId, "Хочу поговорить с мастером")).message).toMatch(/на процедуре/);
    const b = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    expect((await ask(c, b.conversationId, "Сколько стоит консультация?")).message).not.toMatch(/на процедуре/);
  });
});
