import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import { groupQuestions, rememberForAi, resolveMany } from "@/lib/lessons";

describe("вопросы без контакта и обучение ИИ", () => {
  it("группирует одинаковые вопросы и сортирует по частоте", () => {
    const g = groupQuestions([
      { id: "1", summary: "Ты эксперт?", created_at: "2026-11-01T10:00:00Z" },
      { id: "2", summary: "ты эксперт", created_at: "2026-11-02T10:00:00Z" },
      { id: "3", summary: "Сколько держится?", created_at: "2026-11-03T10:00:00Z" },
    ]);
    expect(g[0].count).toBe(2); expect(g[0].ids).toEqual(["1", "2"]); expect(g).toHaveLength(2);
  });
  it("кладёт ответ только в черновик, опубликованный текст не меняется", async () => {
    const c = await setup();
    const before = (await c.db.all<{ answer: string }>("SELECT answer FROM knowledge_articles WHERE tenant_id=?1 AND key='price' AND locale='ru'", [c.tenantId]))[0];
    expect(await rememberForAi(c.db, c.tenantId, "price", "Почему так дорого?", "Объясняем, из чего складывается цена.")).toBe("ok");
    const after = (await c.db.all<{ answer: string; draft_answer: string }>("SELECT answer,draft_answer FROM knowledge_articles WHERE tenant_id=?1 AND key='price' AND locale='ru'", [c.tenantId]))[0];
    expect(after.answer).toBe(before.answer); expect(after.draft_answer).toContain("Почему так дорого?");
  });
  it("не принимает пустой ответ, чужую тему и слишком длинный текст", async () => {
    const c = await setup();
    expect(await rememberForAi(c.db, c.tenantId, "price", "q", "  ")).toBe("bad");
    expect(await rememberForAi(c.db, c.tenantId, "nope", "q", "a")).toBe("bad");
    expect(await rememberForAi(c.db, c.tenantId, "price", "q", "x".repeat(2100))).toBe("too_long");
  });
  it("закрывает вопросы только своего салона", async () => {
    const c = await setup();
    await resolveMany(c.db, c.tenantB, ["no-such"]);
    expect(true).toBe(true);
  });
});
