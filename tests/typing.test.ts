import { describe, it, expect } from "vitest";
import { tokens, msPerWord, totalMs } from "../src/lib/typing";
describe("typing", () => {
  it("сохраняет текст целиком", () => { const t = "Привет,  мир!\nДа."; expect(tokens(t).join("")).toBe(t); });
  it("обычная скорость ~230 слов/мин", () => { expect(Math.round(msPerWord(10))).toBe(261); });
  it("длинный ответ не дольше ~12 с", () => { expect(totalMs(Array(150).fill("слово").join(" "))).toBeLessThanOrEqual(12100); });
});
