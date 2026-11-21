import { describe, it, expect } from "vitest";
import cat from "@/data/playbooks.json";

type Fam = (typeof cat)["families"][number];
const fams = cat.families as Fam[];
const LOCALES = ["ru", "en", "ua"] as const;
// Автоматические FAIL из ТЗ по продающим скриптам: выдуманные цены/скидки, давление, награда за отзыв, диагноз, ложная срочность
const BAD: [string, RegExp][] = [
  ["цифра со скидкой", /\d+\s?%/],
  ["цена в валюте", /(€|eur|евро)\s?\d|\d+\s?(€|eur|евро)/i],
  ["ложная срочность", /(последн|осталось всего|только сегодня|срочно запиш|hurry|last chance|only today|only one slot)/i],
  ["вознаграждение за отзыв", /(скидк|бонус|подар)[^.]{0,40}отзыв|отзыв[^.]{0,40}(скидк|бонус|подар)/i],
  ["диагноз", /(у вас|you have|у вас є)\s+(алопеци|себоре|дерматит|alopecia|dermatitis)/i],
  ["гарантия результата", /(гарантир|100% безопас|абсолютно безопас|guarantee)/i],
];
const ALLOWED_PLACEHOLDER = /\[[^\]]{1,80}\]/g;

describe("каталог сценариев продаж (черновики)", () => {
  it("30 семейств SC01–SC30, без пропусков", () => {
    expect(fams.map((f) => f.id)).toEqual(Array.from({ length: 30 }, (_, i) => `SC${String(i + 1).padStart(2, "0")}`));
  });
  it("у каждого: 3 языка, ≥3 ветви (SC28 допускает 3), стоп-условие, антипример, статус draft", () => {
    for (const f of fams) {
      for (const l of LOCALES) expect(f.message[l].length, `${f.id} ${l}`).toBeGreaterThan(30);
      expect(f.branches.length, f.id).toBeGreaterThanOrEqual(3);
      expect(f.stop_conditions.length, f.id).toBeGreaterThan(0);
      expect(f.anti_example.length, f.id).toBeGreaterThan(10);
      expect(f.status, f.id).toBe("draft");
    }
  });
  it("рекламные семейства требуют согласия на предложения, служебные — нет", () => {
    for (const f of fams) expect(f.requires_marketing_consent, f.id).toBe(f.kind === "marketing");
    expect(fams.find((f) => f.id === "SC10")!.requires_marketing_consent).toBe(false);
    expect(fams.find((f) => f.id === "SC22")!.requires_marketing_consent).toBe(true);
  });
  it("ни в одном тексте нет запрещённых приёмов (кроме поля антипримера)", () => {
    for (const f of fams) {
      const texts = [...LOCALES.map((l) => f.message[l]), f.short_ru, ...f.branches.map((b) => b.reply_ru)];
      for (const t of texts) for (const [name, re] of BAD) expect(re.test(t), `${f.id}: «${t}» — ${name}`).toBe(false);
    }
  });
  it("антипримеры действительно плохие (проверяем, что проверка ловит их)", () => {
    const caught = fams.filter((f) => BAD.some(([, re]) => re.test(f.anti_example))).length;
    expect(caught).toBeGreaterThanOrEqual(10);
  });
  it("SC15: три варианта ответа, нет ответа не считается довольным; SC16 останавливает акции", () => {
    const sc15 = fams.find((f) => f.id === "SC15")!;
    expect(sc15.message.ru).toMatch(/1.*2.*3/);
    expect(sc15.branches.some((b) => /нет ответа/i.test(b.name) && /не «?доволен/i.test(b.reply_ru))).toBe(true);
    expect(fams.find((f) => f.id === "SC16")!.stop_conditions.join(" ")).toMatch(/стоп/i);
  });
  it("SC18: приглашение нейтральное, без бонусов, не только довольным", () => {
    const sc18 = fams.find((f) => f.id === "SC18")!;
    expect(sc18.stop_conditions.join(" ")).toMatch(/без бонусов/);
    expect(sc18.stop_conditions.join(" ")).toMatch(/не только довольные/);
  });
  it("плейсхолдеры одинаковы по числу во всех трёх языках (не потеряна переменная)", () => {
    for (const f of fams) {
      const n = (s: string) => (s.match(ALLOWED_PLACEHOLDER) ?? []).length;
      expect(n(f.message.en), f.id).toBe(n(f.message.ru));
      expect(n(f.message.ua), f.id).toBe(n(f.message.ru));
    }
  });
});

import { render, IS_MARKETING, PREVIEW_LINK, type MsgKind } from "@/lib/lifecycle-templates";
describe("служебные письма не содержат рекламы (QA16) и follow-up построен по схеме 1/2/3 (QA03)", () => {
  const kinds = Object.keys(IS_MARKETING) as MsgKind[];
  for (const k of kinds.filter((x) => !IS_MARKETING[x])) {
    it(`${k}: нет скидок, срочности и допродаж во всех языках`, () => {
      for (const l of ["ru", "en", "uk"] as const) {
        const m = render(k, l, { name: "Тест", salon: "Салон", service: "Консультация", when: "завтра", manageUrl: PREVIEW_LINK });
        for (const [name, re] of BAD) expect(re.test(m.subject + " " + m.body), `${k}/${l}: ${name}`).toBe(false);
        expect(/(акци|sale|discount|знижк|скидк)/i.test(m.body), `${k}/${l}: рекламное слово`).toBe(false);
      }
    });
  }
  it("follow-up просит ответить цифрой 1/2/3 и не спрашивает «есть ли вопросы» вхолостую", () => {
    for (const l of ["ru", "en", "uk"] as const) {
      const b = render("followup", l, { name: "Тест", salon: "Салон", service: "", when: "", manageUrl: PREVIEW_LINK }).body;
      expect(b).toMatch(/1.*2.*3/s);
    }
    expect(render("followup", "ru", { name: "Т", salon: "С", service: "", when: "", manageUrl: PREVIEW_LINK }).body).not.toMatch(/Есть ли у вас вопросы/);
  });
});
