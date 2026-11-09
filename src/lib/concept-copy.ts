// Тексты макетов главной страницы. Это ПРЕДЛОЖЕНИЯ на согласование, не утверждённые тексты.
// Факты только из публикаций студии (Instagram, 2025). Цен, сроков, адреса, сертификатов и обещаний здесь нет.
export type CLang = "en" | "ru" | "uk";
export const CLANGS: CLang[] = ["en", "ru", "uk"];
export const THEMES = ["a", "b", "c"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_NAME: Record<Theme, Record<CLang, string>> = {
  a: { en: "Black & champagne", ru: "Графит и шампань", uk: "Графіт і шампань" },
  b: { en: "Nude & natural", ru: "Нюд и натуральный", uk: "Нюд і натуральний" },
  c: { en: "Burgundy editorial", ru: "Бордо и розовая пудра", uk: "Бордо й рожева пудра" },
};
export const VARIANTS = ["a", "b", "c", "b1", "b2", "b3", "d1", "d2", "d3"] as const;
/** Что показывается в переключателе: остальные варианты открываются по прямой ссылке. */
export const VARIANTS_SHOWN: Variant[] = ["d1", "d2", "d3"];
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_NAME: Record<Variant, string> = {
  a: "Графит и шампань", b: "Нюд и натуральный", c: "Бордо и розовая пудра",
  b1: "B1 Оттенки", b2: "B2 Разговор", b3: "B3 Нить",
  d1: "D1 Жемчуг и пудра", d2: "D2 Сатин и мальва", d3: "D3 Шалфей и шампань",
};
type Card = { id: string; title: string; text: string };
export type Copy = {
  strip: string; variant: string; skip: string;
  nav: { href: string; label: string }[]; book: string; questions: string;
  heroTitle: string; heroText: string; heroCta2: string; chips: string[]; heroCaption: string;
  servicesTitle: string; servicesLead: string; cards: Card[];
  stepsTitle: string; steps: { title: string; text: string }[];
  resultsTitle: string; resultsText: string; before: string; after: string;
  knowTitle: string; knowText: string; knowTag: string; know: string[];
  faqTitle: string; faq: { q: string; a: string }[];
  ctaTitle: string; footer: string; privacy: string;
};

export const COPY: Record<CLang, Copy> = {
  en: {
    strip: "Concept for approval · text, photos and facts are not approved yet", variant: "Variant", skip: "Skip to content",
    nav: [{ href: "#extensions", label: "Extensions" }, { href: "#correction", label: "Correction & removal" }, { href: "#consultation", label: "Consultation" }, { href: "#hair", label: "Slavic hair" }, { href: "#results", label: "Results" }, { href: "#knowledge", label: "Knowledge" }],
    book: "Book a consultation", questions: "Questions",
    heroTitle: "Beautiful length. Natural-looking detail",
    heroText: "Personalised micro- and nano-capsule hair extensions in Dublin. Consultation, application, maintenance and premium hair selection.",
    heroCta2: "Explore results",
    chips: ["Dublin", "Individual quote after consultation", "Micro- and nano-capsules"],
    heroCaption: "Photos of real work will appear here, with the client's permission",
    servicesTitle: "What we do", servicesLead: "Prices are calculated individually after a consultation.",
    cards: [
      { id: "extensions", title: "Hair and application", text: "Premium hair and complete fitting with micro- and nano-capsules. The price depends on length, amount and complexity." },
      { id: "own", title: "Application of your own hair", text: "We fit extensions you already own, once we have checked that they and your own hair are suitable." },
      { id: "correction", title: "Correction and re-bonding", text: "Removal, re-bonding and reapplication of existing extensions as your hair grows." },
      { id: "removal", title: "Removal", text: "Careful stand-alone removal. The price depends on the amount of hair and the complexity." },
      { id: "hair", title: "Premium hair, retail and wholesale", text: "Hair in several lengths and shades for personal use or for salons. Availability and terms are confirmed on request." },
      { id: "consultation", title: "Hair and scalp consultation", text: "A conversation about the condition of your scalp and hair and how to care for it. It does not replace a visit to a doctor." },
    ],
    stepsTitle: "How it works",
    steps: [
      { title: "Consultation", text: "We talk about your goal and look at your own hair." },
      { title: "Individual quote", text: "Hair, length, amount and complexity set the price." },
      { title: "Fitting", text: "Micro- and nano-capsules, placed individually." },
      { title: "Check-in and correction", text: "The specialist sets the timing for your hair." },
    ],
    resultsTitle: "Results", resultsText: "Real before-and-after photos will appear here, taken in the same light and from the same angle, and published only with the client's permission.", before: "Before", after: "After",
    knowTitle: "Hair knowledge", knowText: "Plain-language guides, written with the specialist and checked before publishing.", knowTag: "In preparation",
    know: ["Micro-bonds, nano-bonds and rings: what is the difference", "Caring for your extensions", "When to see a doctor first"],
    faqTitle: "Common questions",
    faq: [
      { q: "How much does it cost?", a: "Prices are calculated individually after a consultation, depending on the hair, the length, the amount and the complexity." },
      { q: "Do extensions damage hair?", a: "Any extensions can, if they are too heavy or tight, poorly cared for or removed incorrectly. The aim is to choose a suitable weight and placement, but no method is risk-free." },
      { q: "Can extensions help with hair loss?", a: "No. They change how hair looks but do not treat the cause, and they add tension. For sudden, patchy or painful loss, please see your doctor first." },
    ],
    ctaTitle: "Ready to talk about your hair", footer: "Demonstration layout. Facts come from the studio's public posts and still need the specialist's approval.", privacy: "Privacy (draft)",
  },
  ru: {
    strip: "Макет для согласования · тексты, фото и факты ещё не утверждены", variant: "Вариант", skip: "К содержимому",
    nav: [{ href: "#extensions", label: "Наращивание" }, { href: "#correction", label: "Коррекция и снятие" }, { href: "#consultation", label: "Консультация" }, { href: "#hair", label: "Славянские волосы" }, { href: "#results", label: "Работы" }, { href: "#knowledge", label: "Знания" }],
    book: "Записаться на консультацию", questions: "Вопросы",
    heroTitle: "Длина, объём и естественный результат",
    heroText: "Индивидуальное микро- и нанокапсульное наращивание в Дублине. Подбор волос, установка, коррекция и консультации.",
    heroCta2: "Посмотреть работы",
    chips: ["Дублин", "Цена индивидуально после консультации", "Микро- и нанокапсулы"],
    heroCaption: "Здесь будут фото реальных работ, с разрешения клиенток",
    servicesTitle: "Чем мы занимаемся", servicesLead: "Цены считаются индивидуально после консультации.",
    cards: [
      { id: "extensions", title: "Волосы и наращивание", text: "Премиальные волосы и полная установка микро- и нанокапсулами. Цена зависит от длины, количества и сложности." },
      { id: "own", title: "Наращивание ваших волос", text: "Устанавливаем пряди, которые у вас уже есть, после проверки, что они и ваши волосы подходят." },
      { id: "correction", title: "Коррекция и переналожение", text: "Снятие, повторное крепление и наращивание уже установленных прядей по мере отрастания волос." },
      { id: "removal", title: "Снятие", text: "Бережное снятие отдельной услугой. Цена зависит от количества волос и сложности." },
      { id: "hair", title: "Премиальные волосы, розница и опт", text: "Волосы разной длины и оттенков для себя или для салонов. Наличие и условия уточняются по запросу." },
      { id: "consultation", title: "Консультация по волосам и коже головы", text: "Разговор о состоянии кожи головы и волос и об уходе. Не заменяет визит к врачу." },
    ],
    stepsTitle: "Как это проходит",
    steps: [
      { title: "Консультация", text: "Обсуждаем вашу цель и смотрим ваши волосы." },
      { title: "Индивидуальная цена", text: "Цену определяют волосы, длина, количество и сложность." },
      { title: "Установка", text: "Микро- и нанокапсулы, размещённые индивидуально." },
      { title: "Проверка и коррекция", text: "Срок для ваших волос назначает мастер." },
    ],
    resultsTitle: "Работы", resultsText: "Здесь будут реальные фото до и после при одинаковом свете и ракурсе. Публикуем только с разрешения клиентки.", before: "До", after: "После",
    knowTitle: "Знания о волосах", knowText: "Понятные статьи, написанные вместе с мастером и проверенные перед публикацией.", knowTag: "Готовится",
    know: ["Микро-, нанокапсулы и кольца: в чём разница", "Как ухаживать за наращиванием", "Когда сначала нужен врач"],
    faqTitle: "Частые вопросы",
    faq: [
      { q: "Сколько это стоит?", a: "Цена считается индивидуально после консультации и зависит от волос, длины, количества и сложности." },
      { q: "Вредит ли наращивание волосам?", a: "Любое наращивание может навредить, если оно слишком тяжёлое или тугое, плохо ухожено или неправильно снято. Цель в том, чтобы подобрать подходящий вес и расположение, но безрисковых методов нет." },
      { q: "Поможет ли наращивание при выпадении волос?", a: "Нет. Оно меняет вид волос, но не лечит причину и добавляет натяжение. При внезапном, очаговом или болезненном выпадении сначала обратитесь к врачу." },
    ],
    ctaTitle: "Готовы поговорить о ваших волосах", footer: "Демонстрационный макет. Факты взяты из публичных публикаций студии и ещё требуют утверждения мастером.", privacy: "Конфиденциальность (черновик)",
  },
  uk: {
    strip: "Макет для погодження · тексти, фото й факти ще не затверджені", variant: "Варіант", skip: "До змісту",
    nav: [{ href: "#extensions", label: "Нарощування" }, { href: "#correction", label: "Корекція і зняття" }, { href: "#consultation", label: "Консультація" }, { href: "#hair", label: "Слов'янське волосся" }, { href: "#results", label: "Роботи" }, { href: "#knowledge", label: "Знання" }],
    book: "Записатися на консультацію", questions: "Питання",
    heroTitle: "Довжина, об'єм і природний результат",
    heroText: "Індивідуальне мікро- та нанокапсульне нарощування в Дубліні. Підбір волосся, встановлення, корекція та консультації.",
    heroCta2: "Переглянути роботи",
    chips: ["Дублін", "Ціна індивідуально після консультації", "Мікро- та нанокапсули"],
    heroCaption: "Тут будуть фото реальних робіт, за згодою клієнток",
    servicesTitle: "Чим ми займаємося", servicesLead: "Ціни розраховуються індивідуально після консультації.",
    cards: [
      { id: "extensions", title: "Волосся й нарощування", text: "Преміальне волосся й повне встановлення мікро- та нанокапсулами. Ціна залежить від довжини, кількості та складності." },
      { id: "own", title: "Нарощування вашого волосся", text: "Встановлюємо пасма, які у вас уже є, після перевірки, що вони й ваше волосся підходять." },
      { id: "correction", title: "Корекція та переналоження", text: "Зняття, повторне кріплення й нарощування вже встановлених пасм у міру відростання волосся." },
      { id: "removal", title: "Зняття", text: "Дбайливе зняття окремою послугою. Ціна залежить від кількості волосся та складності." },
      { id: "hair", title: "Преміальне волосся, роздріб і опт", text: "Волосся різної довжини та відтінків для себе або для салонів. Наявність й умови уточнюються на запит." },
      { id: "consultation", title: "Консультація щодо волосся й шкіри голови", text: "Розмова про стан шкіри голови та волосся й про догляд. Не замінює візит до лікаря." },
    ],
    stepsTitle: "Як це відбувається",
    steps: [
      { title: "Консультація", text: "Обговорюємо вашу мету й дивимося ваше волосся." },
      { title: "Індивідуальна ціна", text: "Ціну визначають волосся, довжина, кількість і складність." },
      { title: "Встановлення", text: "Мікро- та нанокапсули, розміщені індивідуально." },
      { title: "Перевірка й корекція", text: "Строк для вашого волосся призначає майстер." },
    ],
    resultsTitle: "Роботи", resultsText: "Тут будуть реальні фото до й після за однакового світла й ракурсу. Публікуємо лише за згодою клієнтки.", before: "До", after: "Після",
    knowTitle: "Знання про волосся", knowText: "Зрозумілі статті, написані разом із майстром і перевірені перед публікацією.", knowTag: "Готується",
    know: ["Мікро-, нанокапсули та кільця: у чому різниця", "Як доглядати за нарощуванням", "Коли спершу потрібен лікар"],
    faqTitle: "Часті питання",
    faq: [
      { q: "Скільки це коштує?", a: "Ціна розраховується індивідуально після консультації й залежить від волосся, довжини, кількості та складності." },
      { q: "Чи шкодить нарощування волоссю?", a: "Будь-яке нарощування може зашкодити, якщо воно надто важке чи туге, погано доглянуте або неправильно зняте. Мета в тому, щоб підібрати відповідну вагу й розташування, але безризикових методів немає." },
      { q: "Чи допоможе нарощування при випадінні волосся?", a: "Ні. Воно змінює вигляд волосся, але не лікує причину й додає натяг. За раптового, осередкового чи болісного випадіння спершу зверніться до лікаря." },
    ],
    ctaTitle: "Готові поговорити про ваше волосся", footer: "Демонстраційний макет. Факти взято з публічних публікацій студії, і вони ще потребують затвердження майстром.", privacy: "Конфіденційність (чернетка)",
  },
};
