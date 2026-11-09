import { describe, it, expect } from "vitest";
import { splitReply } from "../src/lib/split-reply";
describe("splitReply", () => {
  it("делит абзацы и длинные предложения", () => {
    const r = splitReply("Здравствуйте! Я помощник мастера. Помогу с вопросами.\n\nМожно записаться на консультацию. Выберите время, пожалуйста, и я всё подготовлю для вас.");
    expect(r.length).toBeGreaterThan(1);
    expect(r.join(" ").replace(/\s+/g, " ")).toContain("Выберите время");
  });
  it("не теряет текст и не делит короткий", () => { expect(splitReply("Ок.")).toEqual(["Ок."]); });
  it("не больше 9 реплик", () => { expect(splitReply(Array(30).fill("Это предложение довольно длинное, чтобы занять место.").join(" ")).length).toBeLessThanOrEqual(9); });
});
