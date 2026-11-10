import { js, nowIso, one, rows, uuid, type Db, type Param } from "./db";
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

export async function createTenant(db: Db, opts: { slug: string; name: string; isDemo?: boolean }) {
  const now = nowIso();
  const tenantId = uuid(), staffId = uuid();
  const st: { sql: string; params: Param[] }[] = [];
  st.push({ sql: "INSERT INTO tenants(id,slug,name,default_locale,is_demo,created_at) VALUES (?1,?2,?3,'en',?4,?5)", params: [tenantId, opts.slug, opts.name, opts.isDemo === false ? 0 : 1, now] });
  st.push({ sql: "INSERT INTO staff(id,tenant_id,name) VALUES (?1,?2,'Specialist')", params: [staffId, tenantId] });
  for (const s of SERVICES) {
    const sid = uuid();
    st.push({ sql: "INSERT INTO services(id,tenant_id,slug,title_i18n,desc_i18n,duration_min,buffer_min) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [sid, tenantId, s.slug, js(s.title), js(s.desc), s.duration, s.buffer] });
    st.push({ sql: "INSERT INTO staff_services(staff_id,service_id) VALUES (?1,?2)", params: [staffId, sid] });
  }
  // Стандартные рабочие часы демо: пн–пт 08:00–17:00 местного времени. Мастер меняет их сам в кабинете («Расписание»)
  for (const wd of [1, 2, 3, 4, 5]) st.push({ sql: "INSERT INTO availability_rules(id,tenant_id,staff_id,weekday,start_min,end_min) VALUES (?1,?2,?3,?4,480,1020)", params: [uuid(), tenantId, staffId, wd] });
  for (const key of ["rebook", "referral", "waitlist", "reactivation"]) st.push({ sql: "INSERT INTO automations(tenant_id,key) VALUES (?1,?2)", params: [tenantId, key] });
  const snapshot: unknown[] = [];
  for (const a of ARTICLES) for (const loc of ["en", "ru", "uk"] as const) {
    st.push({ sql: "INSERT INTO knowledge_articles(id,tenant_id,key,topic,locale,title,answer,forbidden,status,approved_by,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'approved','DEMO placeholder',?9)", params: [uuid(), tenantId, a.key, a.topic, loc, a.title[loc], a.answer[loc], js(a.forbidden), now] });
    snapshot.push({ key: a.key, topic: a.topic, locale: loc, title: a.title[loc], answer: a.answer[loc], forbidden: a.forbidden });
  }
  st.push({ sql: "INSERT INTO knowledge_versions(id,tenant_id,version,snapshot,approved_by,active,created_at) VALUES (?1,?2,1,?3,?4,1,?5)", params: [uuid(), tenantId, js(snapshot), "DEMO placeholder (not approved by the specialist)", now] });
  await db.batch(st); // всё или ничего
  return tenantId;
}

/** Публикация = неизменяемый снимок утверждённых статей. Черновики в снимок не попадают. */
export async function publishKnowledge(db: Db, tenantId: string, approvedBy: string): Promise<number> {
  const arts = await rows(db, "SELECT key,topic,locale,title,answer,forbidden FROM knowledge_articles WHERE tenant_id=?1 AND status='approved' ORDER BY key,locale", [tenantId]);
  const last = await one<{ v: number | null }>(db, "SELECT max(version) v FROM knowledge_versions WHERE tenant_id=?1", [tenantId]);
  const version = (last?.v ?? 0) + 1;
  await db.batch([
    { sql: "UPDATE knowledge_versions SET active=0 WHERE tenant_id=?1", params: [tenantId] },
    { sql: "INSERT INTO knowledge_versions(id,tenant_id,version,snapshot,approved_by,active,created_at) VALUES (?1,?2,?3,?4,?5,1,?6)", params: [uuid(), tenantId, version, js(arts), approvedBy, nowIso()] },
  ]);
  return version;
}

export async function seedIfEmpty(db: Db) {
  const t = await one(db, "SELECT id FROM tenants LIMIT 1");
  if (t) return;
  try { await createTenant(db, { slug: "demo", name: "Hair Studio (demo)" }); }
  catch (e) { if (!/UNIQUE/i.test(String((e as Error).message))) throw e; } // параллельный первый запрос уже засеял
}
