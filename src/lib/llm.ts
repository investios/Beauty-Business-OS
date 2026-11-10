import { SKILL_KNOWLEDGE } from "./ai-knowledge";
import { ARTICLES } from "./library";
import type { Locale } from "./ai";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
/** Модели по порядку: если одна недоступна для аккаунта, пробуем следующую */
export const MODELS = ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/mistralai/mistral-small-3.1-24b-instruct", "@cf/meta/llama-3.1-8b-instruct"];
export let lastModel = "";
export const HANDOFF_TOKEN = "[[HANDOFF]]";

/** Вызов модели Cloudflare Workers AI (привязка AI). Если привязки нет или сбой — null, и работает сценарный движок. */
export let lastLlmError = "";
export async function runLlm(messages: ChatMsg[]): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const ai = (ctx.env as unknown as { AI?: { run: (m: string, p: unknown) => Promise<unknown> } }).AI;
    if (!ai) { lastLlmError = "no AI binding"; return null; }
    let out = "";
    for (const model of MODELS) {
      try {
        const res = (await Promise.race([
          ai.run(model, { messages, max_tokens: 420, temperature: 0.3 }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000)),
        ])) as { response?: string; choices?: { message?: { content?: string } }[] };
        out = (res?.response ?? res?.choices?.[0]?.message?.content ?? "").trim();
        if (out) { lastModel = model; break; }
      } catch (e) { lastLlmError = (model + ": " + String((e as Error)?.message ?? e)).slice(0, 200); }
    }
    return out || null;
  } catch (e) { lastLlmError = String((e as Error)?.message ?? e).slice(0, 160); return null; }
}

const LANG: Record<Locale, string> = { ru: "русском", en: "English", uk: "українській" };

export type ApprovedItem = { title: string; answer: string; locale: string };
export function buildSystemPrompt(locale: Locale, approved: ApprovedItem[] = [], version = 0): string {
  const ok = approved.filter((a) => a.locale === locale).map((a) => `- ${a.title}: ${a.answer}`).join("\n");
  const lib = ARTICLES.map((a) => `- ${a.slug}: ${a.aiSummary[locale]} (ссылка /${locale}/library/${a.slug}; статья ${a.status === "approved" ? "утверждена" : "на утверждении у Милы"})`).join("\n");
  return `Ты — ИИ-ассистент студии MK Extension Studio by Mila (Дублин, Ирландия): наращивание волос, здоровье и восстановление волос, уход. Ты НЕ человек и не Мила; если спросят, скажи, что ты ИИ-ассистент студии, отвечающий по информации, которую утверждает Мила.
Отвечай на языке клиента (сейчас: ${LANG[locale]}). Коротко: 2–5 предложений, тёплый профессиональный тон, один уточняющий вопрос в конце, когда он уместен. Без списков и заголовков, без эмодзи.${locale === "uk" ? " Пиши «ШІ-асистент», «нарощування», «волосся»." : locale === "en" ? " Write the whole answer only in English: say \"AI assistant\", \"hair extensions\"; do not use any Russian or Ukrainian words." : ""}

ЖЁСТКИЕ ПРАВИЛА:
- Используй только «Знания» ниже. Утверждённые Милой знания главнее справочных сведений; при расхождении верь утверждённым.
- Справочные сведения студии Мила ещё не утвердила: не выдавай их за рекомендации Милы и не называй проверенными, говори «по информации студии», а индивидуальное передавай ей. Статьи со статусом «на утверждении» называй материалом, который ещё проходит утверждение. Нет в знаниях — не выдумывай: ответь одним словом ${HANDOFF_TOKEN} и больше ничего.
- Никаких цен, скидок, сроков, длительности процедур, адреса, сертификатов, гарантий. Цена считается индивидуально после консультации.
- Никаких диагнозов, лечения, лекарств, добавок, доз. Не обещай «безопасно на 100%», «не вредит», «лечит», «стимулирует рост».
- Не называй Милу врачом и не называй её квалификацию и опыт в годах: это не подтверждено.
- Если вопрос про боль, воспаление, очаги, внезапное или сильное выпадение, симптомы — посоветуй обратиться к врачу и ответь ${HANDOFF_TOKEN}.
- Не обещай записать, проверить время или отправить сообщение: запись делается кнопками «Записаться» и показом свободного времени; скажи, что можно написать «хочу записаться».
- Если вопрос общий о тебе («ты эксперт?», «что умеешь?») — объясни: ты ИИ-ассистент, отвечаешь на вопросы о наращивании, уходе, здоровье волос, помогаешь выбрать консультацию и записаться; сложное и индивидуальное передаёшь Миле.
- Если уместно, предложи прочитать статью из библиотеки и укажи её ссылку из списка ниже.

СТАТЬИ БИБЛИОТЕКИ:
${lib}

УТВЕРЖДЁННЫЕ ЗНАНИЯ (утверждены Милой, версия ${version}):
${ok || "(пока нет утверждённых материалов на этом языке)"}

СПРАВОЧНЫЕ СВЕДЕНИЯ СТУДИИ (из публичных материалов, НЕ утверждены Милой):
${SKILL_KNOWLEDGE}`;
}

/** Проверка ответа модели: цифры цен, обещания, диагнозы, чужая роль. true = ответ безопасен. */
export function answerIsSafe(text: string): boolean {
  if (/€|\beuro?s?\b|евро|\d\s?(?:eur|₴|грн)|\b\d{2,}\s?(?:€|euro)/i.test(text)) return false;
  if (/100\s?%|гарантир|guarantee|не\s+вредит|безвредн|без вреда|harmless|лечит|вылеч|cure[sd]?\b|treats? (?:alopecia|hair loss)|стимулиру\w+ рост|врач-|я мила|i am mila|i'm mila|я — мила|я живой/i.test(text)) return false;
  if (/у вас (?:алопеци|телоген|андроген|дефицит)|you have (?:alopecia|telogen)|у вас є (?:алопеці)/i.test(text)) return false;
  return true;
}
