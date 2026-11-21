import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { handleMessage, startConversation } from "@/lib/ai";
import { makeConsultantSession, makePlatformSession, makeSession, platformPassword, readConsultantSession, readPlatformSession, readSession } from "@/lib/auth";
import { accessLog, conversationsCsv, fullReport, listTenants, logAccess, transcripts } from "@/lib/platform";

describe("панель платформы: вход", () => {
  it("сессии ролей не взаимозаменяемы, подделка не проходит", () => {
    const p = makePlatformSession();
    expect(readPlatformSession(p)).toBe(true);
    expect(readPlatformSession(makeSession("t1"))).toBe(false);
    expect(readPlatformSession(makeConsultantSession("t1"))).toBe(false);
    expect(readSession(p)).toBeNull(); expect(readConsultantSession(p)).toBeNull();
    expect(readPlatformSession(p.slice(0, -2) + "xx")).toBe(false); expect(readPlatformSession(undefined)).toBe(false);
  });
  it("в боевой среде без PLATFORM_PASSWORD панель выключена", () => {
    const env = process.env as Record<string, string | undefined>; const old = [env.NODE_ENV, env.PLATFORM_PASSWORD];
    env.NODE_ENV = "production"; delete env.PLATFORM_PASSWORD;
    expect(platformPassword()).toBeNull();
    env.PLATFORM_PASSWORD = "long-platform-pass"; expect(platformPassword()).toBe("long-platform-pass");
    env.NODE_ENV = old[0]; if (old[1] === undefined) delete env.PLATFORM_PASSWORD; else env.PLATFORM_PASSWORD = old[1];
  });
});

describe("панель платформы: данные", () => {
  it("полный отчёт содержит тексты диалогов и жалобы, а чужой салон не подмешивается", async () => {
    const c = await setup();
    const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    await handleMessage(c.db, { tenantId: c.tenantId, conversationId: id, text: "Сколько стоит наращивание?", localeHint: "ru", now: NOW, llm: async () => null });
    const { conversationId: idB } = await startConversation(c.db, { tenantId: c.tenantB, locale: "ru" });
    await handleMessage(c.db, { tenantId: c.tenantB, conversationId: idB, text: "Секретный вопрос чужого салона", localeHint: "ru", now: NOW, llm: async () => null });
    const rep = (await fullReport(c.db, c.tenantId, 3650))!;
    const json = JSON.stringify(rep);
    expect(json).toContain("Сколько стоит наращивание?");
    expect(json).not.toContain("Секретный вопрос чужого салона");
    expect(rep.conversations[0].messages.some((m) => m.role === "assistant" && m.engine)).toBe(true);
    expect(rep.aggregates.conv).toBeGreaterThan(0);
    expect(rep.settings.length).toBeGreaterThan(5);
    expect(await fullReport(c.db, "no-such", 30)).toBeNull();
    expect((await listTenants(c.db)).length).toBe(2);
  });
  it("CSV не даёт таблице исполнить формулу из текста клиента", async () => {
    const c = await setup();
    const { conversationId: id } = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    await handleMessage(c.db, { tenantId: c.tenantId, conversationId: id, text: "=HYPERLINK(\"http://x\")", localeHint: "ru", now: NOW, llm: async () => null });
    const csv = conversationsCsv(await transcripts(c.db, c.tenantId, 3650));
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).not.toMatch(/,"=HYPERLINK/);
  });
  it("доступ владельца платформы пишется в журнал", async () => {
    const c = await setup();
    await logAccess(c.db, c.tenantId, "platform.export", "report:90d");
    const l = await accessLog(c.db);
    expect(l[0].action).toBe("platform.export");
  });
});
