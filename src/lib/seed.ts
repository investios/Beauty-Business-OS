import type { PGlite } from "@electric-sql/pglite";
import { one, rows } from "./db";

type Q = Pick<PGlite, "query">;
type L3 = { en: string; ru: string; uk: string };

// ВСЕ значения ниже — заглушки для демонстрации (is_placeholder=true), НЕ факты мастера.
// Список того, что нужно получить у мастера, — в docs/OPEN_QUESTIONS.md.
const SERVICES: { slug: string; title: L3; desc: L3; duration: number; buffer: number }[] = [
  {
    slug: "consultation",
    title: { en: "Preliminary consultation", ru: "Предварительная консультация", uk: "Попередня консультація" },
    desc: {
      en: "We discuss your goal and the next steps. The final proposal depends on an individual assessment.",
      ru: "Обсуждаем вашу цель и дальнейшие шаги. Итоговое предложение зависит от индивидуального осмотра.",
      uk: "Обговорюємо вашу мету та подальші кроки. Остаточна пропозиція залежить від індивідуального огляду.",
    },
    duration: 45, buffer: 15,
  },
  {
    slug: "hair-extensions",
    title: { en: "Hair extensions", ru: "Наращивание волос", uk: "Нарощування волосся" },
    desc: {
      en: "Methods, duration and cost are confirmed individually after a consultation.",
      ru: "Методы, длительность и стоимость уточняются индивидуально после консультации.",
      uk: "Методи, тривалість і вартість уточнюються індивідуально після консультації.",
    },
    duration: 120, buffer: 15,
  },
  {
    slug: "signature-technique",
    title: { en: "The specialist's own technique", ru: "Авторская технология мастера", uk: "Авторська технологія майстра" },
    desc: {
      en: "The name, protocol and permitted claims will be added after the specialist provides them.",
      ru: "Название, протокол и допустимые формулировки будут добавлены после того, как их передаст мастер.",
      uk: "Назва, протокол і допустимі формулювання будуть додані після того, як їх надасть майстер.",
    },
    duration: 90, buffer: 15,
  },
];

type Art = { key: string; topic: string; title: L3; answer: L3; forbidden: string[] };
// Нейтральные, не фактические формулировки из ТЗ. Версия 1 = «демо-заглушка», не утверждена мастером.
const ARTICLES: Art[] = [
  {
    key: "price", topic: "price",
    title: { en: "Price", ru: "Цена", uk: "Ціна" },
    answer: {
      en: "The price depends on the chosen procedure and the amount of work. The specialist has not confirmed a price list yet, so I can't name an amount. A preliminary consultation lets the specialist assess it individually.",
      ru: "Стоимость зависит от выбранной процедуры и объёма работы. Прайс мастером пока не подтверждён, поэтому называть сумму я не буду. На предварительной консультации мастер оценит всё индивидуально.",
      uk: "Вартість залежить від обраної процедури та обсягу роботи. Прайс майстер ще не підтвердив, тому називати суму я не буду. На попередній консультації майстер оцінить усе індивідуально.",
    },
    forbidden: ["any euro amount", "discounts"],
  },
  {
    key: "consultation", topic: "consultation",
    title: { en: "Consultation", ru: "Консультация", uk: "Консультація" },
    answer: {
      en: "A preliminary consultation is available by appointment. The final proposal depends on an individual assessment.",
      ru: "Предварительная консультация доступна по записи. Итоговое предложение зависит от индивидуального осмотра.",
      uk: "Попередня консультація доступна за записом. Остаточна пропозиція залежить від індивідуального огляду.",
    },
    forbidden: ["guaranteed result"],
  },
  {
    key: "extensions", topic: "extensions",
    title: { en: "Hair extensions", ru: "Наращивание волос", uk: "Нарощування волосся" },
    answer: {
      en: "The specialist works with hair extensions. Methods, duration and cost are confirmed individually after a consultation; I don't have approved details to share yet.",
      ru: "Мастер работает с наращиванием волос. Методы, длительность и стоимость уточняются индивидуально после консультации; утверждённых подробностей у меня пока нет.",
      uk: "Майстер працює з нарощуванням волосся. Методи, тривалість і вартість уточнюються індивідуально після консультації; затверджених подробиць у мене поки немає.",
    },
    forbidden: ["safe for everyone", "guaranteed result"],
  },
  {
    key: "technique", topic: "technique",
    title: { en: "Own technique", ru: "Авторская технология", uk: "Авторська технологія" },
    answer: {
      en: "The specialist has their own technique related to hair density. Its exact name and what it can and can't do are not yet approved by the specialist, so I won't describe results. I can pass your question to them or help you book a consultation.",
      ru: "У мастера есть авторская технология, связанная с густотой волос. Её точное название и допустимые обещания мастер пока не утвердил, поэтому результаты я описывать не буду. Могу передать вопрос мастеру или помочь записаться на консультацию.",
      uk: "У майстра є авторська технологія, пов'язана з густотою волосся. Її точну назву та допустимі обіцянки майстер ще не затвердив, тому результати я описувати не буду. Можу передати питання майстру або допомогти записатися на консультацію.",
    },
    forbidden: ["growth guarantee", "medical claims"],
  },
  {
    key: "preparation", topic: "preparation",
    title: { en: "Preparation", ru: "Подготовка", uk: "Підготовка" },
    answer: {
      en: "I don't have approved preparation instructions yet. The specialist will tell you everything needed when confirming your visit.",
      ru: "Утверждённых инструкций по подготовке у меня пока нет. Всё необходимое мастер сообщит при подтверждении визита.",
      uk: "Затверджених інструкцій щодо підготовки у мене поки немає. Усе необхідне майстер повідомить при підтвердженні візиту.",
    },
    forbidden: ["medical advice"],
  },
];

export async function createTenant(db: Q, opts: { slug: string; name: string; isDemo?: boolean }) {
  const t = await one<{ id: string }>(db, "INSERT INTO tenants(slug,name,default_locale,is_demo) VALUES ($1,$2,'en',$3) RETURNING id", [opts.slug, opts.name, opts.isDemo ?? true]);
  const tenantId = t!.id;

  const staff = await one<{ id: string }>(db, "INSERT INTO staff(tenant_id,name) VALUES ($1,$2) RETURNING id", [tenantId, "Specialist"]);
  for (const s of SERVICES) {
    const row = await one<{ id: string }>(
      db,
      "INSERT INTO services(tenant_id,slug,title_i18n,desc_i18n,duration_min,buffer_min) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [tenantId, s.slug, JSON.stringify(s.title), JSON.stringify(s.desc), s.duration, s.buffer],
    );
    await db.query("INSERT INTO staff_services(staff_id,service_id) VALUES ($1,$2)", [staff!.id, row!.id]);
  }
  // Заглушка рабочих часов: вт–сб 10:00–18:00 местного времени (нужно подтвердить у мастера)
  for (const wd of [2, 3, 4, 5, 6]) {
    await db.query("INSERT INTO availability_rules(tenant_id,staff_id,weekday,start_min,end_min) VALUES ($1,$2,$3,$4,$5)", [tenantId, staff!.id, wd, 600, 1080]);
  }
  for (const key of ["rebook", "referral", "waitlist", "reactivation"]) {
    await db.query("INSERT INTO automations(tenant_id,key) VALUES ($1,$2)", [tenantId, key]);
  }
  for (const a of ARTICLES) {
    for (const loc of ["en", "ru", "uk"] as const) {
      await db.query(
        "INSERT INTO knowledge_articles(tenant_id,key,topic,locale,title,answer,forbidden,status,approved_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'approved','DEMO placeholder')",
        [tenantId, a.key, a.topic, loc, a.title[loc], a.answer[loc], JSON.stringify(a.forbidden)],
      );
    }
  }
  await publishKnowledge(db, tenantId, "DEMO placeholder (not approved by the specialist)");
  return tenantId;
}

/** Публикация = неизменяемый снимок утверждённых статей. Черновики в снимок не попадают. */
export async function publishKnowledge(db: Q, tenantId: string, approvedBy: string): Promise<number> {
  const arts = await rows(db, "SELECT key,topic,locale,title,answer,forbidden FROM knowledge_articles WHERE tenant_id=$1 AND status='approved' ORDER BY key,locale", [tenantId]);
  const last = await one<{ v: number | null }>(db, "SELECT max(version) v FROM knowledge_versions WHERE tenant_id=$1", [tenantId]);
  const version = (last?.v ?? 0) + 1;
  await db.query("UPDATE knowledge_versions SET active=false WHERE tenant_id=$1", [tenantId]);
  await db.query("INSERT INTO knowledge_versions(tenant_id,version,snapshot,approved_by,active) VALUES ($1,$2,$3,$4,true)", [tenantId, version, JSON.stringify(arts), approvedBy]);
  return version;
}

export async function seedIfEmpty(db: Q) {
  const t = await one(db, "SELECT id FROM tenants LIMIT 1");
  if (!t) await createTenant(db, { slug: "demo", name: "Hair Studio (demo)" });
}
