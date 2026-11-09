import { audit, js, nowIso, one, rows, uuid, type Db } from "./db";
import { getAvailability, listServices } from "./booking";
import { formatLocal, localParts, weekdayOfLocalDate } from "./tz";
import { matchArticle } from "./library";
import { runLlm, lastLlmError, lastModel, buildSystemPrompt, answerIsSafe, HANDOFF_TOKEN, type ChatMsg } from "./llm";

export type Locale = "en" | "ru" | "uk";
export type Intent = "medical" | "human" | "booking" | "price" | "technique" | "extensions" | "consultation" | "preparation" | "greeting" | "contact" | "education" | "unknown";

export type AiReply = {
  message: string; locale: Locale; intent: Intent; knowledgeVersion: number | null; citations: string[];
  slots?: { startUtc: string; label: string; serviceId: string }[];
  articles?: { slug: string; title: string; href: string; draft: boolean }[];
  requiresHuman: boolean; handoffId?: string;
  toolResults: { tool: string; ok: boolean; detail?: string }[];
  // Честная маркировка: это сценарный движок на утверждённых карточках, НЕ языковая модель.
  engine: "scripted-demo" | "llm-demo";
};

/* ---------- язык ---------- */
export function detectLocale(text: string, fallback: Locale): Locale {
  if (/[іїєґІЇЄҐ]/.test(text)) return "uk";
  if (/[а-яё]/i.test(text)) {
    if (/[ыэъё]/i.test(text)) return "ru";
    if (/(?:привіт|будь[\s-]ласка|дякую|можна|скільки|вартість|вільн|волосся|що\b)/i.test(text)) return "uk";
    // Слова, одинаковые в RU и UA: не угадываем, остаёмся в языке страницы
    return fallback === "uk" ? "uk" : "ru";
  }
  if (/[a-z]{3,}/i.test(text)) return "en";
  return fallback;
}

/* ---------- намерение (простые правила; LLM-провайдер подключается вместо этого блока) ---------- */
const MEDICAL = /(рeакци|реакц|сып|аллерг|алерг|ожог|опік|кров|болит|болить|боль\b|біль|зуд|свербі|воспал|запал|инфекц|інфекц|сильно\s+(?:выпада|випада)|(?:выпада|випада)\w*\s+(?:пучками|клочьями|клоч)|внезапн|раптов|резко\s+(?:выпа|випа)|очаг|осередк|проплешин|залысин|лыс|облыс|давлен|беремен|вагітн|rash|allerg|itch|burn|bleed|infect|pain|hurts|swollen|swelling|inflam|pregnan|hair loss falling|falling out a lot|losing a lot|sudden|patchy|bald|clumps|scalp (?:condition|problem)|diagnos|діагноз|диагноз)/i;
/** Образовательные вопросы о выпадении и вреде наращивания: отвечаем кратко по статье библиотеки, без диагноза */
const EDU = /(почему\s+выпада|причин\w*\s+(?:выпад|облыс)|выпадени|выпадают|выпадает|норм\w*\s+(?:выпад|потер)|сколько\s+волос|навредит|вредно|вредит|тракц|чому\s+випада|випадіння|випадає|випадають|скільки\s+волосин|зашкодит|шкідлив|шкодить|hair\s+(?:loss|fall|shedding|thinning)|shedding|thinning|damage\s+(?:my\s+)?(?:natural\s+)?hair|traction|are\s+extensions\s+bad|extensions\s+(?:damage|harm))/i;
const HUMAN = /(живой человек|живого человека|мастер(?:у|ом)?\s+(?:напиш|позвон|передай)|поговорить с мастер|з людиною|з майстром|покличте|human|real person|speak to (?:someone|the specialist|a person)|talk to (?:someone|the specialist)|call me)/i;
const BOOKING = /(запис|записат|записаться|book|appointment|reserve|free (?:time|slot)|available|свобод|вільн|окошк|вікн|slot|час(?:ы|ік)?\b.*(?:есть|можна)|когда можно|коли можна|пятниц|п'ятниц|понедел|понеділ|вторник|вівторок|сред[ау]|середа|четверг|четвер|суббот|субот|воскрес|неділ|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
const PRICE = /(цен[аыу]|стоим|сколько стоит|скільки кошту|вартість|ціна|прайс|price|cost|how much|fee|rate|€|евро|euro)/i;
const TECH = /(авторск|технолог|technique|own method|signature|густот|density|рост волос|ріст волосся|growth|thicker|гуще|густіш)/i;
const EXT = /(наращ|нарощ|extension|extend|hair length|удлин)/i;
const CONSULT = /(консульт|consult)/i;
const PREP = /(подготов|підготов|prepar|before (?:the )?(?:visit|appointment))/i;
const GREET = /^\s*(привет|здравств|добрый|привіт|вітаю|добрий|hello|hi|hey|good (?:morning|afternoon|evening))\b/i;
const CONTACT_RE = /([^\s@]+@[^\s@]+\.[^\s@]{2,})|(\+?\d[\d\s()-]{7,18}\d)/;

export function classify(text: string): Intent[] {
  const out: Intent[] = [];
  if (MEDICAL.test(text)) return ["medical"];            // безопасность выше всего
  if (HUMAN.test(text)) return ["human"];
  if (EDU.test(text)) out.push("education");
  if (PRICE.test(text)) out.push("price");
  if (BOOKING.test(text)) out.push("booking");
  if (TECH.test(text)) out.push("technique");
  if (EXT.test(text)) out.push("extensions");
  if (CONSULT.test(text) && !out.includes("booking")) out.push("consultation");
  if (PREP.test(text)) out.push("preparation");
  if (!out.length && GREET.test(text)) out.push("greeting");
  if (!out.length && CONTACT_RE.test(text)) out.push("contact");
  return out.length ? out : ["unknown"];
}

const WEEKDAY: [RegExp, number][] = [
  [/monday|понедел|понеділ/i, 1], [/tuesday|вторник|вівторок/i, 2], [/wednesday|сред[ау]|середа|середу/i, 3], [/thursday|четверг|четвер/i, 4],
  [/friday|пятниц|п'ятниц|п’ятниц/i, 5], [/saturday|суббот|субот/i, 6], [/sunday|воскрес|неділ/i, 0],
];

/* ---------- тексты интерфейса диалога (не факты о мастере) ---------- */
const T = {
  disclosure: {
    en: "Hi! I'm an AI assistant for this studio. I answer from information approved by the specialist, and I can show real free times. For anything I can't answer, I'll pass your question to the specialist. You can also book directly without chatting with me.",
    ru: "Здравствуйте! Я ИИ-ассистент этой студии. Отвечаю по информации, утверждённой мастером, и могу показать реальное свободное время. Если не смогу ответить, передам вопрос мастеру. Записаться можно и напрямую, без общения со мной.",
    uk: "Вітаю! Я ШІ-асистент цієї студії. Відповідаю за інформацією, затвердженою майстром, і можу показати реальний вільний час. Якщо не зможу відповісти, передам питання майстру. Записатися можна й напряму, без спілкування зі мною.",
  },
  slotsIntro: { en: "Here are the nearest free times:", ru: "Вот ближайшее свободное время:", uk: "Ось найближчий вільний час:" },
  slotsPick: { en: "Choose a time and I'll take you to the booking step.", ru: "Выберите время, и я перейду к оформлению записи.", uk: "Оберіть час, і я перейду до оформлення запису." },
  noSlots: { en: "I can't see free times for that request right now. I can pass this to the specialist so they can suggest a time — please leave a phone number or email.", ru: "Сейчас я не вижу свободного времени по этому запросу. Могу передать мастеру, чтобы он предложил время: оставьте телефон или почту.", uk: "Зараз я не бачу вільного часу за цим запитом. Можу передати майстру, щоб він запропонував час: залиште телефон або пошту." },
  consultQ: { en: "Would you like to see free times for a consultation?", ru: "Показать свободное время для консультации?", uk: "Показати вільний час для консультації?" },
  medical: {
    en: "I'm an AI assistant and can't assess symptoms or give medical advice. I've passed your message to the specialist. If you feel unwell or it's urgent, please contact a medical professional. Please leave a phone number or email so the specialist can reach you.",
    ru: "Я ИИ-ассистент и не могу оценивать симптомы или давать медицинские советы. Я передал ваше сообщение мастеру. Если вам плохо или это срочно, обратитесь к врачу. Оставьте телефон или почту, чтобы мастер мог с вами связаться.",
    uk: "Я ШІ-асистент і не можу оцінювати симптоми чи давати медичні поради. Я передав ваше повідомлення майстру. Якщо вам погано або це терміново, зверніться до лікаря. Залиште телефон або пошту, щоб майстер міг зв'язатися з вами.",
  },
  human: {
    en: "Of course. I've passed this to the specialist. Please leave a phone number or email so they can reach you.",
    ru: "Конечно. Я передал это мастеру. Оставьте телефон или почту, чтобы он мог с вами связаться.",
    uk: "Звісно. Я передав це майстру. Залиште телефон або пошту, щоб він міг зв'язатися з вами.",
  },
  unknown: {
    en: "I don't have approved information on that, and I don't want to guess. I've passed your question to the specialist. Please leave a phone number or email so they can answer you.",
    ru: "Утверждённой информации по этому вопросу у меня нет, и гадать я не хочу. Я передал ваш вопрос мастеру. Оставьте телефон или почту, чтобы он мог вам ответить.",
    uk: "Затвердженої інформації з цього питання у мене немає, і гадати я не хочу. Я передав ваше питання майстру. Залиште телефон або пошту, щоб він міг вам відповісти.",
  },
  contactSaved: { en: "Thank you, I've added your contact to the request. The specialist will reply.", ru: "Спасибо, я добавил ваш контакт к обращению. Мастер ответит.", uk: "Дякую, я додав ваш контакт до звернення. Майстер відповість." },
  contactNoCase: { en: "Thanks. To book a time, choose a free slot on the booking page, or ask me for free times.", ru: "Спасибо. Чтобы записаться, выберите свободное время на странице записи или попросите меня показать время.", uk: "Дякую. Щоб записатися, оберіть вільний час на сторінці запису або попросіть мене показати час." },
  greeting: { en: "How can I help? You can ask about the consultation, the services or free times.", ru: "Чем могу помочь? Можно спросить про консультацию, услуги или свободное время.", uk: "Чим можу допомогти? Можна запитати про консультацію, послуги або вільний час." },
  eduIntro: { en: "This is general educational information, not a diagnosis.", ru: "Это общая образовательная информация, а не диагноз.", uk: "Це загальна освітня інформація, а не діагноз." },
  eduDraft: { en: "(the article is awaiting the specialist's approval)", ru: "(статья на утверждении у мастера)", uk: "(стаття на затвердженні в майстра)" },
  eduRead: { en: "Read more in the knowledge library:", ru: "Подробнее в библиотеке знаний:", uk: "Детальніше в бібліотеці знань:" },
  eduConsult: { en: "For personal advice, a consultation is best. If there is pain, inflammation, patches or sudden heavy shedding, please see a doctor.", ru: "Для индивидуальных рекомендаций лучше записаться на консультацию. При боли, воспалении, очагах или внезапном сильном выпадении обратитесь к врачу.", uk: "Для індивідуальних рекомендацій краще записатися на консультацію. За болю, запалення, осередків або раптового сильного випадіння зверніться до лікаря." },
  priceFrom: { en: "from", ru: "от", uk: "від" },
  priceConfirmed: { en: "Confirmed prices:", ru: "Подтверждённые цены:", uk: "Підтверджені ціни:" },
};

/* ---------- утверждённая база знаний: только активная опубликованная версия ---------- */
type Snap = { key: string; topic: string; locale: string; title: string; answer: string }[];
export async function activeKnowledge(db: Db, tenantId: string) {
  const v = await one<{ version: number; snapshot: Snap }>(db, "SELECT version,snapshot FROM knowledge_versions WHERE tenant_id=?1 AND active=1", [tenantId]);
  return v ?? { version: 0, snapshot: [] as Snap };
}
function article(kb: Snap, topic: string, locale: Locale) {
  return kb.find((a) => a.topic === topic && a.locale === locale);
}

/* ---------- диалоги ---------- */
export async function startConversation(db: Db, p: { tenantId: string; locale: Locale; channel?: string; source?: Record<string, string> }) {
  const kb = await activeKnowledge(db, p.tenantId);
  const convId = uuid();
  await db.run("INSERT INTO conversations(id,tenant_id,locale,channel,source,created_at) VALUES (?1,?2,?3,?4,?5,?6)", [convId, p.tenantId, p.locale, p.channel ?? "website", js(p.source ?? {}), nowIso()]);
  const c = { id: convId };
  const text = T.disclosure[p.locale];
  await db.run("INSERT INTO messages(id,conversation_id,role,content,knowledge_version,meta,created_at) VALUES (?1,?2,'assistant',?3,?4,?5,?6)", [uuid(), c.id, text, kb.version, js({ kind: "disclosure" }), nowIso()]);
  return { conversationId: c.id, message: text };
}

async function handoff(db: Db, tenantId: string, conversationId: string, reason: string, userText: string): Promise<string> {
  const existing = await one<{ id: string }>(db, "SELECT id FROM handoffs WHERE conversation_id=?1 AND status='open' ORDER BY rowid DESC LIMIT 1", [conversationId]);
  if (existing) return existing.id;
  const msgs = await rows<{ role: string; content: string }>(db, "SELECT role,content FROM messages WHERE conversation_id=?1 AND COALESCE(json_extract(meta,'$.kind'),'') <> 'disclosure' ORDER BY rowid DESC LIMIT 4", [conversationId]);
  const summary = msgs.reverse().filter((m) => m.role === "user").map((m) => m.content).join(" / ").slice(0, 500) || userText.slice(0, 500);
  const hid = uuid();
  await db.run("INSERT INTO handoffs(id,tenant_id,conversation_id,reason,summary,created_at) VALUES (?1,?2,?3,?4,?5,?6)", [hid, tenantId, conversationId, reason, summary, nowIso()]);
  await audit(db, tenantId, "ai", "handoff.create", hid, { reason });
  return hid;
}

export async function handleMessage(db: Db, p: { tenantId: string; conversationId: string; text: string; localeHint: Locale; now?: Date; llm?: (m: ChatMsg[]) => Promise<string | null> }): Promise<AiReply> {
  const conv = await one<{ id: string; locale: string }>(db, "SELECT id,locale FROM conversations WHERE id=?1 AND tenant_id=?2", [p.conversationId, p.tenantId]);
  if (!conv) throw new Error("conversation not found");
  const text = p.text.trim().slice(0, 1000);
  const locale = detectLocale(text, p.localeHint);
  const kbv = await activeKnowledge(db, p.tenantId);
  let intents = classify(text);
  const art = intents.includes("education") ? matchArticle(text, locale) : undefined;
  if (intents.includes("education") && !art) { intents = intents.filter((i) => i !== "education"); if (!intents.length) intents = ["unknown"]; }
  const tools: AiReply["toolResults"] = [];
  const citations: string[] = [];
  const parts: string[] = [];
  let slots: AiReply["slots"];
  let articles: AiReply["articles"];
  let requiresHuman = false;
  let engine: AiReply["engine"] = "scripted-demo";
  let handoffId: string | undefined;

  await db.run("INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES (?1,?2,'user',?3,?4)", [uuid(), conv.id, text, nowIso()]);
  await db.run("UPDATE conversations SET locale=?2 WHERE id=?1", [conv.id, locale]);

  const primary = intents[0];
  // Вопрос вне сценариев: пробуем модель (Cloudflare Workers AI) по утверждённым знаниям; при отказе, сбое или небезопасном ответе — передача мастеру
  let llmText: string | null = null;
  const llmEligible = intents.every((i) => ["unknown", "extensions", "technique", "preparation"].includes(i));
  if (llmEligible) {
    const hist = await rows<{ role: string; content: string }>(db, "SELECT role,content FROM messages WHERE conversation_id=?1 AND COALESCE(json_extract(meta,'$.kind'),'') <> 'disclosure' ORDER BY rowid DESC LIMIT 8", [conv.id]);
    const msgs: ChatMsg[] = [{ role: "system", content: buildSystemPrompt(locale) }, ...hist.reverse().map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: m.content }))];
    const out = await (p.llm ?? runLlm)(msgs);
    if (out && !out.includes(HANDOFF_TOKEN) && answerIsSafe(out)) llmText = out.slice(0, 1200);
    tools.push({ tool: "llm", ok: !!llmText, detail: llmText ? "answered " + lastModel : out ? "refused_or_unsafe" : "unavailable: " + lastLlmError });
  }
  if (llmText) {
    engine = "llm-demo";
    parts.push(llmText);
  } else if (primary === "medical" || primary === "human" || primary === "unknown") {
    handoffId = await handoff(db, p.tenantId, conv.id, primary === "medical" ? "medical" : primary === "human" ? "client_requested_human" : "out_of_knowledge", text);
    tools.push({ tool: "requestHandoff", ok: true, detail: handoffId });
    requiresHuman = true;
    parts.push(primary === "medical" ? T.medical[locale] : primary === "human" ? T.human[locale] : T.unknown[locale]);
  } else if (primary === "contact") {
    const open = await one<{ id: string }>(db, "SELECT id FROM handoffs WHERE conversation_id=?1 AND status='open' AND contact IS NULL ORDER BY rowid DESC LIMIT 1", [conv.id]);
    const contact = text.match(CONTACT_RE)?.[0];
    if (open && contact) {
      await db.run("UPDATE handoffs SET contact=?1 WHERE id=?2", [contact, open.id]);
      tools.push({ tool: "requestHandoff", ok: true, detail: "contact attached" });
      requiresHuman = true; handoffId = open.id;
      parts.push(T.contactSaved[locale]);
    } else parts.push(T.contactNoCase[locale]);
  } else if (primary === "greeting") {
    parts.push(T.greeting[locale]);
  } else {
    // Образовательный вопрос: краткая выжимка статьи библиотеки + ссылка + предложение консультации
    if (art && intents.includes("education")) {
      const loc = art.langs[locale] ? locale : "ru";
      const draft = art.status !== "approved";
      parts.push([T.eduIntro[locale], art.aiSummary[locale], draft ? T.eduDraft[locale] : ""].filter(Boolean).join(" "));
      articles = [{ slug: art.slug, title: art.langs[loc]!.title, href: `/${locale}/library/${art.slug}`, draft }];
      citations.push(`library:${art.slug}`);
      tools.push({ tool: "matchArticle", ok: true, detail: art.slug });
      parts.push(T.eduConsult[locale]);
    }
    // Сначала отвечаем на заданный вопрос — только из утверждённой версии знаний
    for (const topic of intents.filter((i) => ["price", "technique", "extensions", "consultation", "preparation"].includes(i))) {
      const a = article(kbv.snapshot, topic === "extensions" ? "extensions" : topic, locale);
      if (a) { parts.push(a.answer); citations.push(a.key); }
    }
    if (intents.includes("price")) {
      // Цены только из таблицы услуг; неподтверждённые не называем
      const confirmed = (await listServices(db, p.tenantId)).filter((s) => s.price_mode !== "unconfirmed" && s.price_from_cents != null);
      if (confirmed.length) {
        parts.push(T.priceConfirmed[locale] + " " + confirmed.map((s) => `${s.title_i18n[locale]}: ${s.price_mode === "from" ? T.priceFrom[locale] + " " : ""}€${(s.price_from_cents! / 100).toFixed(0)}`).join("; "));
        tools.push({ tool: "getServices", ok: true, detail: `${confirmed.length} confirmed prices` });
      }
    }
    // Слоты — только из реального календаря
    const wantsSlots = intents.includes("booking") || intents.includes("price") || intents.includes("consultation") || intents.includes("education");
    if (wantsSlots) {
      const svc = (await listServices(db, p.tenantId)).find((s) => s.slug === "consultation");
      if (svc) {
        const wd = WEEKDAY.find(([re]) => re.test(text))?.[1];
        const all = await getAvailability(db, { tenantId: p.tenantId, serviceId: svc.id, now: p.now, days: 21 });
        const filtered = wd == null ? all : all.filter((s) => { const lp = localParts(new Date(s.startUtc).getTime()); return weekdayOfLocalDate(lp.y, lp.mo, lp.d) === wd; });
        const pick = (filtered.length ? filtered : []).slice(0, 4);
        tools.push({ tool: "getAvailability", ok: true, detail: `${pick.length} slots` });
        if (pick.length && (intents.includes("booking") || intents.includes("consultation") || intents.includes("education"))) {
          slots = pick.map((s) => ({ startUtc: s.startUtc, label: formatLocal(new Date(s.startUtc).getTime(), locale), serviceId: svc.id }));
          parts.push(T.slotsIntro[locale] + " " + T.slotsPick[locale]);
        } else if (!pick.length && intents.includes("booking")) {
          handoffId = await handoff(db, p.tenantId, conv.id, "no_slots", text);
          requiresHuman = true;
          parts.push(T.noSlots[locale]);
        } else if (intents.includes("price")) {
          parts.push(T.consultQ[locale]); // одно уточнение/предложение, без давления
        }
      }
    }
  }

  const message = parts.join("\n\n");
  await db.run("INSERT INTO messages(id,conversation_id,role,content,knowledge_version,meta,created_at) VALUES (?1,?2,'assistant',?3,?4,?5,?6)", [uuid(), conv.id, message, kbv.version, js({ intents, citations, tools, engine }), nowIso()]);
  return { message, locale, intent: primary, knowledgeVersion: kbv.version, citations, slots, articles, requiresHuman, handoffId, toolResults: tools, engine };
}
