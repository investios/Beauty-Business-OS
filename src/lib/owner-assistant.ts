import { addLocalDays, localParts } from "./tz";
import { ymdKey, type Ymd } from "./calendar";

/** Помощник владельца: понимает фразу вроде «я заболела с 15 по 17 декабря» и строит ТОЛЬКО предпросмотр.
 *  Он ничего не отменяет и ничего не отправляет: решение и отправка за владельцем. */
const MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6, июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
  січня: 1, лютого: 2, березня: 3, квітня: 4, травня: 5, червня: 6, липня: 7, серпня: 8, вересня: 9, жовтня: 10, листопада: 11, грудня: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};
const MON_RE = Object.keys(MONTHS).join("|");
export type Absence = { ok: true; from: Ymd; to: Ymd; understood: string } | { ok: false; ask: string };

const valid = (y: number, mo: number, d: number) => { const t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d; };
const iso = (x: Ymd) => ymdKey(x);
/** Год по умолчанию: ближайшая такая дата не раньше чем 30 дней назад */
function withYear(today: Ymd, mo: number, d: number): Ymd | null {
  for (const y of [today.y, today.y + 1]) {
    if (!valid(y, mo, d)) continue;
    const diff = (Date.UTC(y, mo - 1, d) - Date.UTC(today.y, today.mo - 1, today.d)) / 86400000;
    if (diff >= -30) return { y, mo, d };
  }
  return null;
}

export function parseAbsence(textRaw: string, nowMs: number): Absence {
  const text = textRaw.toLowerCase().replace(/ё/g, "е");
  const p = localParts(nowMs), today: Ymd = { y: p.y, mo: p.mo, d: p.d };
  const done = (from: Ymd, to: Ymd): Absence => (to.y * 400 + to.mo * 32 + to.d < from.y * 400 + from.mo * 32 + from.d
    ? { ok: false, ask: "Дата окончания раньше даты начала. Уточните, пожалуйста, период." }
    : { ok: true, from, to, understood: from.d === to.d && from.mo === to.mo && from.y === to.y ? iso(from) : `${iso(from)} — ${iso(to)}` });
  // 15.12 - 17.12 / с 15.12 по 17.12 / 15/12
  const num = [...text.matchAll(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/g)];
  if (num.length) {
    const toYmd = (m: RegExpMatchArray) => { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null; return y ? (valid(y, +m[2], +m[1]) ? { y, mo: +m[2], d: +m[1] } : null) : withYear(today, +m[2], +m[1]); };
    const a = toYmd(num[0]); const b = num[1] ? toYmd(num[1]) : a;
    if (a && b) return done(a, b);
  }
  // «с 15 по 17 декабря», «15 декабря», «15 - 17 декабря», «15 to 17 december»
  const range = text.match(new RegExp(`(\\d{1,2})\\s*(?:по|до|-|–|—|to|till|until|through)\\s*(\\d{1,2})\\s*(${MON_RE})`));
  if (range) { const a = withYear(today, MONTHS[range[3]], +range[1]), b = withYear(today, MONTHS[range[3]], +range[2]); if (a && b) return done(a, b); }
  const two = text.match(new RegExp(`(\\d{1,2})\\s*(${MON_RE})\\s*(?:по|до|-|–|—|to|till|until)\\s*(\\d{1,2})\\s*(${MON_RE})`));
  if (two) { const a = withYear(today, MONTHS[two[2]], +two[1]), b = withYear(today, MONTHS[two[4]], +two[3]); if (a && b) return done(a, b); }
  const one = text.match(new RegExp(`(\\d{1,2})\\s*(${MON_RE})`));
  if (one) { const a = withYear(today, MONTHS[one[2]], +one[1]); if (a) return done(a, a); }
  // относительные: сегодня / завтра / послезавтра + «на N дней/неделю»
  const rel: [RegExp, number][] = [[/(послезавтра|day after tomorrow|післязавтра)/, 2], [/(завтра|tomorrow)/, 1], [/(сегодня|сьогодні|today)/, 0]];
  for (const [re, off] of rel) if (re.test(text)) {
    const from = addLocalDays(today.y, today.mo, today.d, off);
    const n = text.match(/(?:на|for)\s*(\d{1,2})\s*(?:дн|день|дня|днів|day)/); const wk = /(недел|тиждень|тижні|week)/.test(text);
    const days = n ? Math.min(30, Math.max(1, +n[1])) : wk ? 7 : 1;
    return done(from, addLocalDays(from.y, from.mo, from.d, days - 1));
  }
  return { ok: false, ask: "Не поняла даты. Напишите, например: «заболела с 15 по 17 декабря», «меня не будет завтра» или «на 3 дня с завтрашнего дня»." };
}

/** Черновики для клиентов (не отправляются). Без причины и подробностей: только факт и предложение выбрать новое время */
export const ABSENCE_DRAFT: Record<"ru" | "en" | "uk", string> = {
  ru: "Здравствуйте, {name}! К сожалению, мастер не сможет принять вас {when}. Приносим извинения. Выберите, пожалуйста, новое удобное время на сайте или ответьте на это письмо, и мы подберём его вместе.",
  en: "Hello {name}, unfortunately the specialist will not be able to see you {when}. We apologise. Please choose a new time on our website or reply to this email and we will find one together.",
  uk: "Вітаємо, {name}! На жаль, майстер не зможе прийняти вас {when}. Просимо вибачення. Оберіть, будь ласка, новий зручний час на сайті або дайте відповідь на цей лист, і ми підберемо його разом.",
};
