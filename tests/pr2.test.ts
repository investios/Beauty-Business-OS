import { describe, it, expect, vi } from "vitest";
import { buildSystemPrompt } from "@/lib/llm";
import { clientIp } from "@/lib/ratelimit";

describe("PR-2: знания AI", () => {
  it("утверждённые знания идут отдельным блоком и главнее справочных", () => {
    const p = buildSystemPrompt("ru", [{ title: "Консультация", answer: "Утверждённый текст про консультацию", locale: "ru" }, { title: "Other", answer: "english only", locale: "en" }], 3);
    expect(p).toContain("УТВЕРЖДЁННЫЕ ЗНАНИЯ (утверждены Милой, версия 3)");
    expect(p).toContain("Утверждённый текст про консультацию");
    expect(p).not.toContain("english only");
    expect(p).toContain("НЕ утверждены Милой");
    expect(p.indexOf("УТВЕРЖДЁННЫЕ ЗНАНИЯ")).toBeLessThan(p.indexOf("СПРАВОЧНЫЕ СВЕДЕНИЯ"));
  });
  it("без утверждённых материалов прямо говорит об этом", () => {
    expect(buildSystemPrompt("en")).toContain("пока нет утверждённых материалов");
  });
});

describe("PR-2: адрес клиента для лимитов", () => {
  const req = (h: Record<string, string>) => new Request("http://x", { headers: h });
  it("доверяет cf-connecting-ip", () => {
    expect(clientIp(req({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });
  it("в production не доверяет подделываемому x-forwarded-for", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9" }))).toBe("unknown");
    vi.unstubAllEnvs();
  });
  it("в разработке x-forwarded-for допустим", () => {
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
  });
});
