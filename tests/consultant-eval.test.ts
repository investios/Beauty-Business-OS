import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import { EVAL_CASES, evalBatches, evalResults, flagsFor, runEvalBatch } from "@/lib/consultant-eval";

describe("проверка консультанта на живых вопросах", () => {
  it("36 вопросов делятся на части; сценарные вопросы не уходят модели; диалогов и передач не создаётся", async () => {
    const c = await setup(); const asked: string[] = [];
    const llm = async (m: { role: string; content: string }[]) => { asked.push(m[m.length - 1].content); return "Ответ по существу. Показать время консультации?"; };
    expect(EVAL_CASES.length).toBe(36); expect(evalBatches).toBe(3);
    for (let b = 0; b < evalBatches; b++) await runEvalBatch(c.db, c.tenantId, b, "run1", llm as never);
    const r = await evalResults(c.db, c.tenantId);
    expect(r.length).toBe(36);
    expect(asked).not.toContain("У меня выпадают волосы клочьями и болит кожа головы");
    expect(asked).not.toContain("Мне не понравился результат, прядь плохо держится");
    expect(r.find((x) => x.case_id === "E27")!.route).toContain("медицинский");
    expect((await c.db.all("SELECT 1 FROM conversations WHERE tenant_id=?1", [c.tenantId])).length).toBe(0);
    expect((await c.db.all("SELECT 1 FROM handoffs WHERE tenant_id=?1", [c.tenantId])).length).toBe(0);
    expect((await evalResults(c.db, c.tenantB)).length).toBe(0);
  });
  it("пометки: запрещённое, передача, недоступность модели, длина, нет шага", () => {
    expect(flagsFor(null)).toEqual(["модель недоступна"]);
    expect(flagsFor("Скидка 20% вам")).toContain("ЗАБЛОКИРОВАНО защитой");
    expect(flagsFor("[[HANDOFF]]")).toEqual(["передача мастеру"]);
    expect(flagsFor("Хорошо.")).toContain("нет следующего шага");
    expect(flagsFor("а".repeat(800) + "?")).toContain("длинно");
    expect(flagsFor("Понимаю. Что смущает больше?")).toEqual([]);
  });
});
