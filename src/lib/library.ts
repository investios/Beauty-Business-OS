import type { Loc } from "./i18n";
import { ARTICLES } from "./library-articles";

export type Cat = "trichology" | "recovery" | "extensions" | "care";
export type Block = { t: "h2" | "p"; text: string } | { t: "ul"; items: string[] };
export interface Source { title: string; publisher: string; url: string; year?: string; note?: string; /** общий справочный источник: не показывается читателю */ general?: boolean }
export interface Localized { title: string; excerpt: string; body: Block[]; faq: { q: string; a: string }[] }
export type Tier = 1 | 2 | 3 | 4; // 1 утверждено владельцем · 2 документация производителя · 3 медицина/университеты/рецензируемое · 4 общее
export interface Article {
  slug: string; cat: Cat; status: "draft" | "approved"; ownerReviewed: boolean; updated: string; minutes: number;
  keywords: Record<Loc, string[]>; aiSummary: Record<Loc, string>; related: string[]; hub: string;
  langs: Partial<Record<Loc, Localized>>; sources: (Source & { tier: Tier })[]; editorNotes?: string[];
}

export { ARTICLES };
export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const publicArticles = () => ARTICLES;
/** Версия статьи на языке; если перевода нет — русская, с пометкой */
export function localize(a: Article, loc: Loc): { content: Localized; fallback: boolean } {
  const own = a.langs[loc];
  if (own) return { content: own, fallback: false };
  return { content: a.langs.ru!, fallback: true };
}

/** Карта первых статей (15 из ТЗ + 3 дополнительные). status: written = есть текст на утверждении, planned = только тема */
export interface PlanItem { n: number; slug: string; cat: Cat; cluster: "A" | "B" | "C" | "D" | "E"; ru: string; en: string; query: string; state: "written" | "planned" }
export const ARTICLE_PLAN: PlanItem[] = [
  { n: 1, slug: "why-hair-falls-out", cat: "trichology", cluster: "A", ru: "Почему выпадают волосы: самые частые причины", en: "Why hair falls out: the most common causes", query: "why does hair fall out", state: "written" },
  { n: 2, slug: "normal-shedding-when-to-seek-advice", cat: "trichology", cluster: "A", ru: "Когда выпадение волос — норма, а когда пора к врачу", en: "When hair shedding is normal and when to seek advice", query: "is hair shedding normal", state: "written" },
  { n: 3, slug: "can-extensions-damage-your-hair", cat: "extensions", cluster: "B", ru: "Может ли наращивание навредить своим волосам", en: "Can hair extensions damage your own hair?", query: "can hair extensions damage natural hair", state: "written" },
  { n: 4, slug: "choose-extension-method-safely", cat: "extensions", cluster: "B", ru: "Как безопасно выбрать способ наращивания", en: "How to choose a hair extension method safely", query: "safest hair extension method", state: "planned" },
  { n: 5, slug: "extensions-for-thin-hair", cat: "extensions", cluster: "B", ru: "Наращивание на тонкие волосы: что важнее всего", en: "Hair extensions for thin hair: what matters most", query: "extensions for thin hair", state: "planned" },
  { n: 6, slug: "trichology-consultation-can-and-cannot", cat: "trichology", cluster: "D", ru: "Что может и чего не может трихологическая консультация", en: "What a trichology consultation can and cannot do", query: "trichology consultation what to expect", state: "planned" },
  { n: 7, slug: "extension-care-keep-beautiful", cat: "care", cluster: "E", ru: "Как ухаживать за нарощенными волосами, чтобы они дольше выглядели красиво", en: "How to care for extensions to keep them beautiful longer", query: "how to care for hair extensions", state: "planned" },
  { n: 8, slug: "extension-aftercare-mistakes", cat: "care", cluster: "E", ru: "Частые ошибки в уходе после наращивания", en: "Common mistakes in extension aftercare", query: "hair extension aftercare mistakes", state: "planned" },
  { n: 9, slug: "damaged-hair-what-recovery-means", cat: "recovery", cluster: "C", ru: "Повреждённые волосы: что на самом деле значит восстановление", en: "Damaged hair: what recovery really means", query: "how to restore damaged hair", state: "planned" },
  { n: 10, slug: "stress-and-hair", cat: "trichology", cluster: "A", ru: "Как стресс влияет на состояние волос", en: "How stress affects hair condition", query: "stress hair shedding", state: "planned" },
  { n: 11, slug: "density-breakage-scalp-health", cat: "trichology", cluster: "D", ru: "Густота, ломкость и здоровье кожи головы: в чём разница", en: "Hair density, breakage and scalp health: how they differ", query: "hair thinning vs breakage", state: "planned" },
  { n: 12, slug: "hair-growth-myths", cat: "recovery", cluster: "C", ru: "Мифы о росте волос и «чудо-средствах»", en: "Myths about hair growth and miracle treatments", query: "hair growth myths", state: "planned" },
  { n: 13, slug: "healthy-hair-routine", cat: "care", cluster: "E", ru: "Как выстроить здоровый уход за волосами", en: "How to build a healthy hair routine", query: "healthy hair routine", state: "planned" },
  { n: 14, slug: "questions-before-extensions", cat: "extensions", cluster: "B", ru: "Что спросить перед наращиванием", en: "What to ask before getting extensions", query: "what to ask before hair extensions", state: "planned" },
  { n: 15, slug: "beauty-goals-start-with-hair-health", cat: "recovery", cluster: "C", ru: "Экспертный гид: когда красота начинается со здоровья волос", en: "Expert guide: when beauty goals should start with hair health", query: "hair health before extensions", state: "planned" },
  { n: 16, slug: "postpartum-hair-loss", cat: "trichology", cluster: "A", ru: "Выпадение волос после родов: что известно", en: "Postpartum hair loss: what is known", query: "postpartum hair loss", state: "planned" },
  { n: 17, slug: "how-to-wash-extensions", cat: "care", cluster: "E", ru: "Как правильно мыть нарощенные волосы", en: "How to wash hair extensions correctly", query: "how to wash hair extensions", state: "planned" },
  { n: 18, slug: "seasonal-shedding", cat: "trichology", cluster: "A", ru: "Сезонное выпадение волос: бывает ли оно", en: "Seasonal hair shedding: is it real?", query: "seasonal hair shedding", state: "planned" },
];

/** Подбор статьи под вопрос (для ИИ-консультанта): по ключевым словам; возвращает лучшую статью или undefined */
export function matchArticle(text: string, loc: Loc): Article | undefined {
  const q = text.toLowerCase();
  let best: { a: Article; score: number } | undefined;
  for (const a of ARTICLES) {
    let score = 0;
    for (const k of [...a.keywords[loc], ...a.keywords.ru, ...a.keywords.en]) if (q.includes(k.toLowerCase())) score += k.length > 6 ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { a, score };
  }
  return best?.a;
}
