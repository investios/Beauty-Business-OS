import { audit, js, nowIso, one, type Db } from "./db";

/** Профиль мастера: то, что отличает одного мастера от другого в текстах и в ИИ. Не зависит от конкретного человека. */
export type Locale = "ru" | "en" | "uk";
export const TONES = {
  warm: "Тёплый и заботливый: говорит как внимательный мастер, без официоза",
  expert: "Спокойный эксперт: ясно, точно, без лишних эмоций",
  concise: "Коротко и по делу: минимум слов, максимум пользы",
  friendly: "Дружелюбный и лёгкий: простой живой язык, уместная мягкая шутка",
} as const;
export type Tone = keyof typeof TONES;
export type Profile = {
  masterName: string; masterNameLatin: string; studioName: string; city: string;
  addressForm: "vy" | "ty"; tone: Tone; forms: Partial<Record<"gen" | "dat" | "acc" | "ins", string>>; about: string; configured: boolean;
};
/** Пока профиль не заполнен, тексты говорят нейтрально («мастер»), а не чужим именем */
export const NEUTRAL: Profile = { masterName: "", masterNameLatin: "", studioName: "", city: "", addressForm: "vy", tone: "warm", forms: {}, about: "", configured: false };

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[<>{}[\]\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export async function getProfile(db: Db, tenantId: string): Promise<Profile> {
  try {
    const r = await one<{ master_name: string; master_name_latin: string; studio_name: string; city: string; address_form: string; tone: string; forms: string | Record<string, string>; about: string }>(db, "SELECT master_name,master_name_latin,studio_name,city,address_form,tone,forms,about FROM tenant_profile WHERE tenant_id=?1", [tenantId]);
    if (!r) return NEUTRAL;
    let forms: Profile["forms"] = {};
    try { forms = typeof r.forms === "string" ? JSON.parse(r.forms || "{}") : (r.forms ?? {}); } catch { /* пусто */ }
    return {
      masterName: r.master_name, masterNameLatin: r.master_name_latin, studioName: r.studio_name, city: r.city,
      addressForm: r.address_form === "ty" ? "ty" : "vy", tone: (r.tone in TONES ? r.tone : "warm") as Tone, forms, about: r.about, configured: !!r.master_name,
    };
  } catch { return NEUTRAL; } // таблицы ещё нет (миграция не применена)
}

export async function saveProfile(db: Db, tenantId: string, i: Record<string, unknown>, by = "owner"): Promise<{ ok: boolean; reason?: string }> {
  const name = clean(i.masterName, 40);
  if (!name) return { ok: false, reason: "name" };
  const tone = String(i.tone) in TONES ? String(i.tone) : "warm";
  const forms = Object.fromEntries((["gen", "dat", "acc", "ins"] as const).map((k) => [k, clean(i[`form_${k}`], 40)]).filter(([, v]) => v));
  try {
    await db.run(
      `INSERT INTO tenant_profile(tenant_id,master_name,master_name_latin,studio_name,city,address_form,tone,forms,about,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
       ON CONFLICT(tenant_id) DO UPDATE SET master_name=?2,master_name_latin=?3,studio_name=?4,city=?5,address_form=?6,tone=?7,forms=?8,about=?9,updated_at=?10`,
      [tenantId, name, clean(i.masterNameLatin, 40), clean(i.studioName, 80), clean(i.city, 60), i.addressForm === "ty" ? "ty" : "vy", tone, js(forms), clean(i.about, 600), nowIso()]);
  } catch { return { ok: false, reason: "migration" }; }
  await audit(db, tenantId, by, "profile.save");
  return { ok: true };
}

const HARD = /[гкхжчшщ]$/i;
/** Падежи имени: родительный, дательный, винительный, творительный. Простое правило для женских имён на -а/-я; для остальных вернёт имя без изменений,
 *  тогда мастер задаёт формы вручную в профиле. */
export function declineName(name: string, locale: Locale): { gen: string; dat: string; acc: string; ins: string } {
  const n = name.trim(); const same = { gen: n, dat: n, acc: n, ins: n };
  if (!n) return same;
  const last = n.slice(-1).toLowerCase(), stem = n.slice(0, -1), pre = stem.slice(-1).toLowerCase();
  if (locale === "ru") {
    if (/(ия)$/i.test(n)) return { gen: stem + "и", dat: stem + "и", acc: stem + "ю", ins: stem + "ей" };
    if (last === "а") { const hard = HARD.test(stem); return { gen: stem + (hard ? "и" : "ы"), dat: stem + "е", acc: stem + "у", ins: stem + "ой" }; }
    if (last === "я") return { gen: stem + "и", dat: stem + "е", acc: stem + "ю", ins: stem + "ей" };
    return same;
  }
  if (locale === "uk") {
    if (/(ія)$/i.test(n)) return { gen: stem + "ї", dat: stem + "ї", acc: stem + "ю", ins: stem + "єю" };
    if (last === "а") { const hard = HARD.test(stem) || pre === "р"; return { gen: stem + (hard ? "и" : "и"), dat: stem + "і", acc: stem + "у", ins: stem + "ою" }; }
    if (last === "я") return { gen: stem + "і", dat: stem + "і", acc: stem + "ю", ins: stem + "ею" };
    return same;
  }
  return same; // английский не склоняется
}

/** Значения для подстановки в тексты: {master}, {master_gen}, {master_dat}, {master_acc}, {master_ins}, {studio}, {city} */
export function profileVars(p: Profile, locale: Locale): Record<string, string> {
  const base = locale === "en" ? (p.masterNameLatin || p.masterName) : p.masterName;
  const d = declineName(base, locale);
  const generic = locale === "en" ? "the specialist" : locale === "uk" ? "майстер" : "мастер";
  const gGen = locale === "en" ? "the specialist" : locale === "uk" ? "майстра" : "мастера";
  const gDat = locale === "en" ? "the specialist" : locale === "uk" ? "майстру" : "мастеру";
  const gAcc = locale === "en" ? "the specialist" : locale === "uk" ? "майстра" : "мастера";
  const gIns = locale === "en" ? "the specialist" : locale === "uk" ? "майстром" : "мастером";
  const has = !!base;
  return {
    master: has ? base : generic,
    master_gen: has ? (locale === "ru" ? p.forms.gen : undefined) ?? d.gen : gGen,
    master_dat: has ? (locale === "ru" ? p.forms.dat : undefined) ?? d.dat : gDat,
    master_acc: has ? (locale === "ru" ? p.forms.acc : undefined) ?? d.acc : gAcc,
    master_ins: has ? (locale === "ru" ? p.forms.ins : undefined) ?? d.ins : gIns,
    studio: p.studioName || (locale === "en" ? "the studio" : locale === "uk" ? "студія" : "студия"),
    city: p.city,
  };
}
export const fillProfile = (text: string, vars: Record<string, string>) => text.replace(/\{(master|master_gen|master_dat|master_acc|master_ins|studio|city)\}/g, (_, k: string) => vars[k] ?? "");
