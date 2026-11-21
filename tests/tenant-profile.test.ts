import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { startConversation } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/llm";
import cat from "@/data/playbooks.json";
import { declineName, fillProfile, getProfile, profileVars, saveProfile } from "@/lib/tenant-profile";

describe("профиль мастера", () => {
  it("склоняет женские имена по-русски и по-украински, остальное оставляет как есть", () => {
    expect(declineName("Мила", "ru")).toEqual({ gen: "Милы", dat: "Миле", acc: "Милу", ins: "Милой" });
    expect(declineName("Ольга", "ru")).toEqual({ gen: "Ольги", dat: "Ольге", acc: "Ольгу", ins: "Ольгой" });
    expect(declineName("Мария", "ru")).toEqual({ gen: "Марии", dat: "Марии", acc: "Марию", ins: "Марией" });
    expect(declineName("Юля", "ru")).toEqual({ gen: "Юли", dat: "Юле", acc: "Юлю", ins: "Юлей" });
    expect(declineName("Олена", "uk")).toEqual({ gen: "Олени", dat: "Олені", acc: "Олену", ins: "Оленою" });
    expect(declineName("Антон", "ru").gen).toBe("Антон");
  });
  it("без профиля тексты говорят «мастер», а не чужое имя; с профилем подставляется своё", async () => {
    const c = await setup();
    const a = await startConversation(c.db, { tenantId: c.tenantId, locale: "ru" });
    expect(a.message).toContain("студии Милы");
    const b = await startConversation(c.db, { tenantId: c.tenantB, locale: "ru" });
    expect(b.message).not.toContain("Мил");
    expect(b.message).toContain("мастера");
    expect((await saveProfile(c.db, c.tenantB, { masterName: "Анна", masterNameLatin: "Anna", studioName: "Anna Hair", city: "Варшава" })).ok).toBe(true);
    const b2 = await startConversation(c.db, { tenantId: c.tenantB, locale: "ru" });
    expect(b2.message).toContain("студии Анны"); expect(b2.message).toContain("передам Анне");
    const bEn = await startConversation(c.db, { tenantId: c.tenantB, locale: "en" });
    expect(bEn.message).toContain("Anna's studio");
    expect(a.message).not.toContain("Анн");
  });
  it("промпт модели берёт имя и студию из профиля, не из кода", async () => {
    const c = await setup();
    await saveProfile(c.db, c.tenantB, { masterName: "Анна", studioName: "Anna Hair", city: "Варшава" });
    const p = buildSystemPrompt("ru", [], 1, await getProfile(c.db, c.tenantB));
    expect(p).toContain("Anna Hair (Варшава)"); expect(p.split("\n")[0]).not.toMatch(/Мил|Mila/); expect(p).toContain("не Анна");
  });
  it("пустое имя не сохраняется; служебные символы вычищаются", async () => {
    const c = await setup();
    expect((await saveProfile(c.db, c.tenantB, { masterName: "   " })).ok).toBe(false);
    await saveProfile(c.db, c.tenantB, { masterName: "A<b>nna{x}", about: "x[y]" });
    const p = await getProfile(c.db, c.tenantB);
    expect(p.masterName).not.toMatch(/[<>{}]/); expect(p.about).not.toMatch(/[\[\]]/);
  });
  it("в каталоге сценариев нет вшитого имени, только подстановки", () => {
    const s = JSON.stringify(cat.families);
    expect(s).not.toMatch(/Мил|Mila|Міл/);
    const tokens = new Set(s.match(/\{[a-z_]+\}/g));
    for (const t of tokens) expect(["{master}", "{master_gen}", "{master_dat}", "{master_acc}", "{master_ins}"]).toContain(t);
    const v = profileVars({ masterName: "Анна", masterNameLatin: "Anna", studioName: "", city: "", addressForm: "vy", tone: "warm", forms: {}, about: "", referencePack: "", configured: true }, "ru");
    expect(fillProfile(s, v)).not.toMatch(/\{master/);
  });
});
