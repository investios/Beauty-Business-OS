import type { Loc } from "./i18n";

/** Тексты сайта (RU/EN/UA). Без выдуманных цифр, цен, сроков и отзывов. Всё, что про Милу лично, помечено в QUESTIONS_FOR_MILA.md. */
export type HubId = "extensions" | "trichology" | "recovery" | "care" | "consultation";
export const HUBS: HubId[] = ["extensions", "trichology", "recovery", "care", "consultation"];
/** Какая услуга записи соответствует разделу (slug из таблицы services) */
export const HUB_SERVICE: Record<HubId, string> = {
  extensions: "hair-extensions", trichology: "consultation", recovery: "consultation", care: "consultation", consultation: "consultation",
};
export const HUB_IMG: Partial<Record<HubId, { a: string; wa: number; b: string; wb: number; w: number; h: number }>> = {
  extensions: { a: "tile-extensions-300", wa: 300, b: "tile-extensions-450", wb: 450, w: 300, h: 400 },
  trichology: { a: "tile-trichology-360", wa: 360, b: "tile-trichology-720", wb: 720, w: 360, h: 210 },
};

interface Hub { title: string; tile: string; lead: string; points: string[]; note: string }
interface Copy {
  nav: { home: string; about: string; services: string; library: string; results: string; contact: string; book: string; menu: string; lang: string };
  brandTop: string; brandSub: string; demoNote: string;
  hero: { eyebrow: string; name: string; title: string; text: string; cta1: string; cta2: string; slogan: string; proof: string[]; alt: string };
  aboutBlock: { eyebrow: string; title: string; text: string; link: string; facts: string[]; alt: string };
  servicesTitle: string; servicesLead: string; more: string;
  hubs: Record<HubId, Hub>;
  hubLabels: { what: string; related: string; ask: string };
  lib: { eyebrow: string; title: string; text: string; all: string; read: string; draftBadge: string; approvedBadge: string; sources: string; faq: string; related: string; disclaimer: string; reviewed: string; notReviewed: string; langPending: string; back: string; cats: Record<string, string>; indexTitle: string; indexLead: string; minRead: string };
  aboutPage: { title: string; lead: string; blocks: { h: string; p: string }[]; cta: string };
  results: { title: string; lead: string; empty: string; why: string; cta: string };
  contact: { title: string; lead: string; rows: { h: string; p: string }[]; cta: string };
  footer: { tag: string; explore: string; legal: string };
}

export const SC: Record<Loc, Copy> = {
  ru: {
    nav: { home: "Главная", about: "О Миле", services: "Услуги", library: "Библиотека знаний", results: "Результаты", contact: "Контакты", book: "Записаться", menu: "Меню", lang: "Язык" },
    brandTop: "Extension Studio", brandSub: "by Mila", demoNote: "Демонстрационный сайт: тексты, фотографии, цены и сроки ещё проходят утверждение мастером.",
    hero: {
      eyebrow: "Эксперт по волосам", name: "Мила", title: "Наращивание, здоровье и восстановление волос",
      text: "Комплексный подход к красоте и здоровью ваших волос: от эстетики наращивания до понятного разбора того, что происходит с волосами и кожей головы.",
      cta1: "Записаться на консультацию", cta2: "О моём подходе", slogan: "Красивые волосы начинаются с их здоровья",
      proof: ["Экспертный подход", "Научная основа", "Индивидуальные решения"], alt: "Мила, мастер по наращиванию и здоровью волос",
    },
    aboutBlock: {
      eyebrow: "Обо мне", title: "Почему я занимаюсь здоровьем и красотой волос",
      text: "Я объединяю эстетику наращивания с вниманием к здоровью волос и кожи головы. Моя цель — не только создать красивый образ, но и сохранить качество и силу ваших собственных волос.",
      link: "Узнать мою историю",
      facts: ["Наращивание и забота о здоровье волос в одном месте", "Постоянное обучение и работа с исследованиями", "Индивидуальный подбор решений под ваши волосы"], alt: "Портрет Милы",
    },
    servicesTitle: "Услуги", servicesLead: "Выберите направление или начните с консультации: Мила поможет понять, что подходит именно вам.", more: "Подробнее",
    hubs: {
      extensions: { title: "Наращивание волос", tile: "Естественная длина, густота и объём", lead: "Естественная длина, густота и объём с учётом состояния ваших собственных волос.", points: ["Обсуждаем, чего вы хотите: длину, густоту, цвет", "Оцениваем состояние ваших волос и кожи головы", "Вместе подбираем способ наращивания и ритм ухода и коррекций"], note: "Технологии, материалы, сроки и стоимость уточняются на консультации и зависят от ваших волос." },
      trichology: { title: "Трихология", tile: "Оценка состояния волос и кожи головы", lead: "Спокойный разбор того, что происходит с волосами: выпадение, истончение, чувствительная кожа головы.", points: ["Вы рассказываете, что беспокоит и как давно", "Мила оценивает внешнее состояние волос и кожи головы", "Вы получаете общие шаги по уходу и понимание, когда лучше обратиться к врачу"], note: "Это консультация по уходу и образованию, а не медицинская услуга: диагноз и лечение назначает врач." },
      recovery: { title: "Восстановление волос", tile: "Укрепление, питание и поддержка", lead: "Укрепление и питание волос с понятным планом домашнего ухода.", points: ["Разбираем, что могло ослабить волосы: окрашивание, тепло, натяжение, стресс, питание", "Подбираем щадящий уход и режим", "Решаем, нужна ли пауза в наращивании"], note: "Результат зависит от причин и особенностей ваших волос; мы не обещаем конкретных изменений." },
      care: { title: "Уход и поддержка", tile: "Домашний уход, подбор средств и рекомендации", lead: "Домашний уход, подбор средств и рекомендации после услуг.", points: ["Как мыть, сушить и расчёсывать волосы", "Какие средства подходят именно вам", "Срок коррекции Мила называет индивидуально"], note: "Рекомендации по средствам появятся здесь после утверждения мастером." },
      consultation: { title: "Консультация", tile: "Первый шаг", lead: "Первый шаг: поговорить с Милой о ваших волосах и целях.", points: ["Расскажите о волосах, пожеланиях и вопросах", "Мила подскажет, какое направление подходит", "Вы решаете, нужна ли следующая услуга"], note: "Стоимость и длительность подтверждаются мастером; сейчас они не показаны." },
    },
    hubLabels: { what: "Как это проходит", related: "Читайте в библиотеке", ask: "Задать вопрос" },
    lib: {
      eyebrow: "Библиотека знаний", title: "Понятно о волосах и коже головы", text: "Статьи с источниками: что известно о выпадении, наращивании и уходе — и когда стоит обратиться к врачу.", all: "Все статьи", read: "Читать",
      draftBadge: "На утверждении у Милы", approvedBadge: "Утверждено Милой", sources: "Источники", faq: "Короткие ответы", related: "Читайте также", back: "К библиотеке",
      disclaimer: "Материал носит образовательный характер и не заменяет консультацию врача. При внезапном или сильном выпадении, очагах, боли, воспалении и зуде кожи головы обратитесь к врачу.",
      reviewed: "Проверено Милой", notReviewed: "Ещё не проверено Милой", langPending: "Перевод этой статьи готовится, показываем русскую версию.",
      cats: { trichology: "Трихология", recovery: "Восстановление", extensions: "Наращивание", care: "Уход" }, indexTitle: "Библиотека знаний", indexLead: "Статьи для тех, кто хочет разобраться. Каждая — с источниками и пометкой о проверке.", minRead: "мин чтения",
    },
    aboutPage: {
      title: "О Миле", lead: "Мастер по наращиванию волос в Дублине, для которой красота невозможна без здоровья волос.",
      blocks: [
        { h: "Подход", p: "Я объединяю эстетику наращивания с вниманием к здоровью волос и кожи головы. Сначала разбираемся, в каком состоянии ваши собственные волосы, потом выбираем решение." },
        { h: "Честность", p: "Я не обещаю того, чего нельзя гарантировать, и говорю прямо, когда лучше пойти к врачу или сделать паузу в наращивании." },
        { h: "Знания", p: "Для сайта мы собираем библиотеку статей с источниками: это помогает вам разобраться самим и прийти на консультацию с понятными вопросами." },
      ], cta: "Записаться на консультацию",
    },
    results: { title: "Результаты", lead: "Здесь будут реальные работы Милы.", empty: "Фотографии появятся после письменного согласия клиентов и утверждения мастером. Мы не показываем чужие или стоковые снимки как работы мастера.", why: "Почему не сейчас: результат зависит от волос, освещения и окрашивания, поэтому каждое фото сопровождается пояснением.", cta: "Обсудить ваши цели" },
    contact: {
      title: "Контакты", lead: "Самый быстрый способ — записаться на консультацию или задать вопрос ассистенту.",
      rows: [{ h: "Город", p: "Дублин, Ирландия. Точный адрес студии будет добавлен после подтверждения мастером." }, { h: "Запись", p: "Онлайн-запись работает по настоящему календарю мастера; время указано по Дублину." }, { h: "Вопросы", p: "ИИ-ассистент отвечает по утверждённой информации и передаёт сложные вопросы Миле." }],
      cta: "Выбрать время",
    },
    footer: { tag: "Красивые волосы начинаются с их здоровья", explore: "Разделы", legal: "Правовая информация" },
  },
  en: {
    nav: { home: "Home", about: "About Mila", services: "Services", library: "Knowledge library", results: "Results", contact: "Contact", book: "Book", menu: "Menu", lang: "Language" },
    brandTop: "Extension Studio", brandSub: "by Mila", demoNote: "Demonstration site: texts, photos, prices and timings are still waiting for the specialist's approval.",
    hero: {
      eyebrow: "Hair expert", name: "Mila", title: "Hair extensions, health and recovery",
      text: "A complete approach to the beauty and health of your hair: from the aesthetics of extensions to a clear look at what is happening with your hair and scalp.",
      cta1: "Book a consultation", cta2: "My approach", slogan: "Beautiful hair starts with healthy hair",
      proof: ["Expert approach", "Science-based", "Individual solutions"], alt: "Mila, hair extension and hair health specialist",
    },
    aboutBlock: {
      eyebrow: "About me", title: "Why I work on hair health and beauty",
      text: "I combine the aesthetics of extensions with attention to the health of your hair and scalp. My aim is not only a beautiful look, but also keeping your own hair strong and in good condition.",
      link: "Read my story",
      facts: ["Extensions and hair health care in one place", "Continuous learning and work with research", "Solutions chosen for your hair"], alt: "Portrait of Mila",
    },
    servicesTitle: "Services", servicesLead: "Choose a direction or start with a consultation: Mila will help you see what suits you.", more: "Learn more",
    hubs: {
      extensions: { title: "Hair extensions", tile: "Natural length, density and volume", lead: "Natural length, density and volume, chosen with the condition of your own hair in mind.", points: ["We discuss what you want: length, density, colour", "We look at the condition of your hair and scalp", "Together we choose the method and the rhythm of care and corrections"], note: "Methods, materials, timing and cost are confirmed at the consultation and depend on your hair." },
      trichology: { title: "Trichology", tile: "Looking at hair and scalp condition", lead: "A calm look at what is happening with your hair: shedding, thinning, a sensitive scalp.", points: ["You tell Mila what worries you and for how long", "Mila looks at the outer condition of your hair and scalp", "You get general care steps and a clear idea of when to see a doctor"], note: "This is care and education guidance, not a medical service: diagnosis and treatment belong to a doctor." },
      recovery: { title: "Hair recovery", tile: "Strengthening, nourishing and support", lead: "Strengthening and nourishing your hair with a clear home-care plan.", points: ["We look at what may have weakened the hair: colouring, heat, tension, stress, diet", "We choose gentle care and routine", "We decide whether a break from extensions is needed"], note: "Results depend on the causes and on your hair; no specific outcome is promised." },
      care: { title: "Care and support", tile: "Home care, product choice and advice", lead: "Home care, product choice and advice after your service.", points: ["How to wash, dry and brush your hair", "Which products suit you", "Mila names the correction time individually"], note: "Product recommendations will appear here after the specialist approves them." },
      consultation: { title: "Consultation", tile: "The first step", lead: "The first step: talk with Mila about your hair and goals.", points: ["Tell us about your hair, wishes and questions", "Mila suggests which direction suits you", "You decide whether you need a further service"], note: "Price and duration are confirmed by the specialist and are not shown yet." },
    },
    hubLabels: { what: "How it goes", related: "Read in the library", ask: "Ask a question" },
    lib: {
      eyebrow: "Knowledge library", title: "Hair and scalp, explained clearly", text: "Articles with sources: what is known about shedding, extensions and care, and when to see a doctor.", all: "All articles", read: "Read",
      draftBadge: "Awaiting Mila's approval", approvedBadge: "Approved by Mila", sources: "Sources", faq: "Quick answers", related: "Related reading", back: "Back to the library",
      disclaimer: "This material is educational and does not replace a doctor's advice. If hair loss is sudden or heavy, or there are bald patches, pain, inflammation or an itchy scalp, see a doctor.",
      reviewed: "Reviewed by Mila", notReviewed: "Not yet reviewed by Mila", langPending: "The translation of this article is being prepared; showing the Russian version.",
      cats: { trichology: "Trichology", recovery: "Recovery", extensions: "Extensions", care: "Care" }, indexTitle: "Knowledge library", indexLead: "Articles for people who want to understand. Each one has sources and a review status.", minRead: "min read",
    },
    aboutPage: {
      title: "About Mila", lead: "A hair extension specialist in Dublin for whom beauty is impossible without healthy hair.",
      blocks: [
        { h: "Approach", p: "I combine the aesthetics of extensions with attention to hair and scalp health. First we look at the condition of your own hair, then we choose a solution." },
        { h: "Honesty", p: "I do not promise what cannot be guaranteed, and I say plainly when it is better to see a doctor or take a break from extensions." },
        { h: "Knowledge", p: "For this site we are building a library of articles with sources, so you can understand things yourself and come to a consultation with clear questions." },
      ], cta: "Book a consultation",
    },
    results: { title: "Results", lead: "Real work by Mila will appear here.", empty: "Photos will be published after clients give written consent and the specialist approves them. We do not show other people's or stock photos as Mila's work.", why: "Why not yet: results depend on hair, lighting and colouring, so each photo comes with an explanation.", cta: "Discuss your goals" },
    contact: {
      title: "Contact", lead: "The fastest way is to book a consultation or ask the assistant.",
      rows: [{ h: "City", p: "Dublin, Ireland. The exact studio address will be added after the specialist confirms it." }, { h: "Booking", p: "Online booking uses the specialist's real calendar; times are in Dublin time." }, { h: "Questions", p: "The AI assistant answers from approved information and passes complex questions to Mila." }],
      cta: "Choose a time",
    },
    footer: { tag: "Beautiful hair starts with healthy hair", explore: "Sections", legal: "Legal" },
  },
  uk: {
    nav: { home: "Головна", about: "Про Мілу", services: "Послуги", library: "Бібліотека знань", results: "Результати", contact: "Контакти", book: "Записатися", menu: "Меню", lang: "Мова" },
    brandTop: "Extension Studio", brandSub: "by Mila", demoNote: "Демонстраційний сайт: тексти, фотографії, ціни та терміни ще проходять затвердження майстром.",
    hero: {
      eyebrow: "Експерт із волосся", name: "Міла", title: "Нарощування, здоров'я та відновлення волосся",
      text: "Комплексний підхід до краси й здоров'я вашого волосся: від естетики нарощування до зрозумілого розбору того, що відбувається з волоссям і шкірою голови.",
      cta1: "Записатися на консультацію", cta2: "Про мій підхід", slogan: "Гарне волосся починається зі здоров'я",
      proof: ["Експертний підхід", "Наукова основа", "Індивідуальні рішення"], alt: "Міла, майстер із нарощування та здоров'я волосся",
    },
    aboutBlock: {
      eyebrow: "Про мене", title: "Чому я займаюся здоров'ям і красою волосся",
      text: "Я поєдную естетику нарощування з увагою до здоров'я волосся та шкіри голови. Моя мета — не лише створити гарний образ, а й зберегти якість і силу вашого власного волосся.",
      link: "Дізнатися мою історію",
      facts: ["Нарощування та турбота про здоров'я волосся в одному місці", "Постійне навчання та робота з дослідженнями", "Індивідуальний добір рішень під ваше волосся"], alt: "Портрет Міли",
    },
    servicesTitle: "Послуги", servicesLead: "Оберіть напрям або почніть із консультації: Міла допоможе зрозуміти, що підходить саме вам.", more: "Детальніше",
    hubs: {
      extensions: { title: "Нарощування волосся", tile: "Природна довжина, густота й об'єм", lead: "Природна довжина, густота й об'єм з урахуванням стану вашого власного волосся.", points: ["Обговорюємо, чого ви хочете: довжину, густоту, колір", "Оцінюємо стан вашого волосся та шкіри голови", "Разом добираємо спосіб нарощування та ритм догляду й корекцій"], note: "Технології, матеріали, терміни та вартість уточнюються на консультації й залежать від вашого волосся." },
      trichology: { title: "Трихологія", tile: "Оцінка стану волосся та шкіри голови", lead: "Спокійний розбір того, що відбувається з волоссям: випадіння, стоншення, чутлива шкіра голови.", points: ["Ви розповідаєте, що турбує і як давно", "Міла оцінює зовнішній стан волосся та шкіри голови", "Ви отримуєте загальні кроки догляду та розумієте, коли краще звернутися до лікаря"], note: "Це консультація з догляду та освіти, а не медична послуга: діагноз і лікування призначає лікар." },
      recovery: { title: "Відновлення волосся", tile: "Зміцнення, живлення та підтримка", lead: "Зміцнення та живлення волосся зі зрозумілим планом домашнього догляду.", points: ["Розбираємо, що могло послабити волосся: фарбування, тепло, натяг, стрес, харчування", "Добираємо делікатний догляд і режим", "Вирішуємо, чи потрібна пауза в нарощуванні"], note: "Результат залежить від причин та особливостей вашого волосся; ми не обіцяємо конкретних змін." },
      care: { title: "Догляд і підтримка", tile: "Домашній догляд, добір засобів і рекомендації", lead: "Домашній догляд, добір засобів і рекомендації після послуг.", points: ["Як мити, сушити та розчісувати волосся", "Які засоби підходять саме вам", "Термін корекції Міла називає індивідуально"], note: "Рекомендації щодо засобів з'являться тут після затвердження майстром." },
      consultation: { title: "Консультація", tile: "Перший крок", lead: "Перший крок: поговорити з Мілою про ваше волосся та цілі.", points: ["Розкажіть про волосся, побажання та запитання", "Міла підкаже, який напрям підходить", "Ви вирішуєте, чи потрібна наступна послуга"], note: "Вартість і тривалість підтверджуються майстром; зараз їх не показано." },
    },
    hubLabels: { what: "Як це відбувається", related: "Читайте в бібліотеці", ask: "Поставити запитання" },
    lib: {
      eyebrow: "Бібліотека знань", title: "Зрозуміло про волосся та шкіру голови", text: "Статті з джерелами: що відомо про випадіння, нарощування й догляд — і коли варто звернутися до лікаря.", all: "Усі статті", read: "Читати",
      draftBadge: "На затвердженні в Міли", approvedBadge: "Затверджено Мілою", sources: "Джерела", faq: "Короткі відповіді", related: "Читайте також", back: "До бібліотеки",
      disclaimer: "Матеріал має освітній характер і не замінює консультацію лікаря. За раптового або сильного випадіння, осередків, болю, запалення чи свербежу шкіри голови зверніться до лікаря.",
      reviewed: "Перевірено Мілою", notReviewed: "Ще не перевірено Мілою", langPending: "Переклад цієї статті готується, показуємо російську версію.",
      cats: { trichology: "Трихологія", recovery: "Відновлення", extensions: "Нарощування", care: "Догляд" }, indexTitle: "Бібліотека знань", indexLead: "Статті для тих, хто хоче розібратися. Кожна — з джерелами та позначкою про перевірку.", minRead: "хв читання",
    },
    aboutPage: {
      title: "Про Мілу", lead: "Майстер із нарощування волосся в Дубліні, для якої краса неможлива без здорового волосся.",
      blocks: [
        { h: "Підхід", p: "Я поєдную естетику нарощування з увагою до здоров'я волосся та шкіри голови. Спочатку розбираємося, у якому стані ваше власне волосся, потім обираємо рішення." },
        { h: "Чесність", p: "Я не обіцяю того, чого не можна гарантувати, і кажу прямо, коли краще піти до лікаря чи зробити паузу в нарощуванні." },
        { h: "Знання", p: "Для сайту ми збираємо бібліотеку статей із джерелами: це допомагає вам розібратися самим і прийти на консультацію зі зрозумілими запитаннями." },
      ], cta: "Записатися на консультацію",
    },
    results: { title: "Результати", lead: "Тут будуть справжні роботи Міли.", empty: "Фотографії з'являться після письмової згоди клієнтів і затвердження майстром. Ми не показуємо чужі чи стокові знімки як роботи майстра.", why: "Чому не зараз: результат залежить від волосся, освітлення та фарбування, тому кожне фото супроводжується поясненням.", cta: "Обговорити ваші цілі" },
    contact: {
      title: "Контакти", lead: "Найшвидший спосіб — записатися на консультацію або поставити запитання асистенту.",
      rows: [{ h: "Місто", p: "Дублін, Ірландія. Точну адресу студії буде додано після підтвердження майстром." }, { h: "Запис", p: "Онлайн-запис працює за справжнім календарем майстра; час вказано за Дубліном." }, { h: "Запитання", p: "ШІ-асистент відповідає за затвердженою інформацією та передає складні запитання Мілі." }],
      cta: "Обрати час",
    },
    footer: { tag: "Гарне волосся починається зі здоров'я", explore: "Розділи", legal: "Правова інформація" },
  },
};
