import type { Article } from "./library";

/**
 * Пилотные статьи. Статус: draft (на утверждении у Милы), ownerReviewed: false.
 * Факты взяты из источников ниже; медицинских обещаний и диагнозов нет.
 */
const MAYO = { title: "Hair loss: Symptoms and causes", publisher: "Mayo Clinic", url: "https://www.mayoclinic.org/diseases-conditions/hair-loss/symptoms-causes/syc-20372926", year: "2026 (обновлено 8 февраля)", tier: 3 as const };
const TE = { title: "Telogen Effluvium", publisher: "StatPearls (NCBI Bookshelf)", url: "https://www.ncbi.nlm.nih.gov/books/NBK430848/", tier: 3 as const, note: "Сроки при telogen effluvium перед утверждением перепроверить по полному тексту (страница при проверке не открылась)." };
const TRACTION = { title: "Traction alopecia: the root of the problem", publisher: "Billero V, Miteva M. Clin Cosmet Investig Dermatol 11:149–159", url: "https://www.dovepress.com/traction-alopecia-the-root-of-the-problem-peer-reviewed-fulltext-article-CCID", year: "2018", tier: 3 as const };

export const ARTICLES: Article[] = [
  {
    slug: "why-hair-falls-out", cat: "trichology", status: "draft", ownerReviewed: false, updated: "2026-11-09", minutes: 4, hub: "trichology",
    keywords: {
      ru: ["почему выпада", "причины выпадения", "выпадение волос", "выпадают волосы", "причины облысения", "истончение волос"],
      en: ["why does hair fall", "hair fall", "hair loss", "causes of hair loss", "thinning hair"],
      uk: ["чому випада", "причини випадіння", "випадіння волосся", "випадає волосся", "стоншення волосся"],
    },
    aiSummary: {
      ru: "Чаще всего выпадение связано с наследственностью, гормональными изменениями, некоторыми заболеваниями и лекарствами, сильным стрессом, а также с тугими причёсками. Причину определяет врач.",
      en: "Hair loss is most often linked to heredity, hormonal changes, some conditions and medicines, major stress and tight hairstyles. A doctor identifies the cause.",
      uk: "Найчастіше випадіння пов'язане зі спадковістю, гормональними змінами, деякими захворюваннями та ліками, сильним стресом і тугими зачісками. Причину визначає лікар.",
    },
    related: ["normal-shedding-when-to-seek-advice", "can-extensions-damage-your-hair"],
    sources: [{ ...MAYO, note: "Нормальная потеря 50–100 волос в день, список причин, когда обращаться к врачу" }, { ...TE, note: "Временное диффузное выпадение после стресса и болезни" }],
    editorNotes: ["Утверждение Милой обязательно.", "Перепроверить текст StatPearls (страница не открылась при подготовке)."],
    langs: {
      ru: {
        title: "Почему выпадают волосы: самые частые причины",
        excerpt: "Наследственность, гормоны, болезни, лекарства, стресс и причёски: что чаще всего стоит за выпадением и когда пора к врачу.",
        body: [
          { t: "h2", text: "Что считается нормой" },
          { t: "p", text: "В среднем человек теряет около 50–100 волос в день. О выпадении говорят, когда новые волосы не успевают заменить выпавшие." },
          { t: "h2", text: "Основные причины" },
          { t: "ul", items: [
            "Наследственность (андрогенетическая алопеция): самая частая причина.",
            "Гормональные изменения: беременность и роды, менопауза, проблемы с щитовидной железой.",
            "Заболевания: например, гнездная алопеция, грибковые инфекции кожи головы, трихотилломания.",
            "Некоторые лекарства и добавки, а также лучевая терапия головы.",
            "Сильный физический или эмоциональный стресс: обычно это временное поредение.",
            "Причёски и процедуры: тугие причёски, горячие масла, химическая завивка.",
          ] },
          { t: "h2", text: "Почему не стоит гадать" },
          { t: "p", text: "Похожее выпадение может иметь разные причины, а подходы к ним разные. Определить причину может врач, а не косметический уход." },
          { t: "h2", text: "Что можно сделать самому" },
          { t: "ul", items: [
            "Записать, когда началось и что менялось: болезнь, стресс, лекарства, питание, причёски.",
            "Не натягивать волосы туго и не перегревать их.",
            "Не начинать «лечение» добавками и средствами, не посоветовавшись с врачом.",
          ] },
          { t: "h2", text: "Когда обратиться к врачу" },
          { t: "ul", items: [
            "Выпадение началось внезапно или стало заметно больше обычного.",
            "Появились очаги, пятна без волос.",
            "Есть зуд, боль, покраснение или шелушение кожи головы.",
            "У женщины отступает линия роста волос.",
            "Выпадение сильно беспокоит.",
          ] },
        ],
        faq: [
          { q: "Выпадение волос — это всегда болезнь?", a: "Нет. Ежедневная потеря нескольких десятков волос — норма. Но если стало заметно больше или появились очаги, лучше показаться врачу." },
          { q: "Поможет ли наращивание скрыть редкие волосы?", a: "Это зависит от причины и состояния ваших волос. Сначала важно выяснить причину; Мила обсудит это с вами на консультации." },
        ],
      },
      en: {
        title: "Why hair falls out: the most common causes",
        excerpt: "Heredity, hormones, illness, medicines, stress and hairstyles: what most often lies behind hair loss and when to see a doctor.",
        body: [
          { t: "h2", text: "What counts as normal" },
          { t: "p", text: "On average a person loses about 50–100 hairs a day. Hair loss is when new hair does not keep up with what is shed." },
          { t: "h2", text: "Main causes" },
          { t: "ul", items: [
            "Heredity (androgenetic alopecia): the most common cause.",
            "Hormonal changes: pregnancy and childbirth, menopause, thyroid problems.",
            "Medical conditions: for example alopecia areata, fungal scalp infections, trichotillomania.",
            "Some medicines and supplements, and radiation therapy to the head.",
            "Major physical or emotional stress: usually temporary thinning.",
            "Hairstyles and treatments: tight hairstyles, hot-oil treatments, permanents.",
          ] },
          { t: "h2", text: "Why not to guess" },
          { t: "p", text: "Similar-looking hair loss can have different causes, and the approaches differ. A doctor, not cosmetic care, can identify the cause." },
          { t: "h2", text: "What you can do yourself" },
          { t: "ul", items: [
            "Write down when it started and what changed: illness, stress, medicines, diet, hairstyles.",
            "Avoid pulling hair tight and avoid overheating it.",
            "Do not start supplements or products as a \"treatment\" without talking to a doctor.",
          ] },
          { t: "h2", text: "When to see a doctor" },
          { t: "ul", items: [
            "The loss started suddenly or is clearly more than usual.",
            "There are patches without hair.",
            "The scalp is itchy, painful, red or flaky.",
            "A woman's hairline is receding.",
            "The loss worries you a lot.",
          ] },
        ],
        faq: [
          { q: "Is hair shedding always a disease?", a: "No. Losing several dozen hairs a day is normal. If it is clearly more than usual or there are patches, see a doctor." },
          { q: "Can extensions hide thinning hair?", a: "It depends on the cause and on the condition of your own hair. First it is important to find the cause; Mila will talk this through at a consultation." },
        ],
      },
      uk: {
        title: "Чому випадає волосся: найчастіші причини",
        excerpt: "Спадковість, гормони, хвороби, ліки, стрес і зачіски: що найчастіше стоїть за випадінням і коли час до лікаря.",
        body: [
          { t: "h2", text: "Що вважається нормою" },
          { t: "p", text: "У середньому людина втрачає близько 50–100 волосин на день. Про випадіння говорять, коли нове волосся не встигає замінити те, що випало." },
          { t: "h2", text: "Основні причини" },
          { t: "ul", items: [
            "Спадковість (андрогенетична алопеція): найчастіша причина.",
            "Гормональні зміни: вагітність і пологи, менопауза, проблеми зі щитоподібною залозою.",
            "Захворювання: наприклад, гніздова алопеція, грибкові інфекції шкіри голови, трихотиломанія.",
            "Деякі ліки та добавки, а також променева терапія голови.",
            "Сильний фізичний або емоційний стрес: зазвичай це тимчасове рідшання.",
            "Зачіски та процедури: туго стягнуті зачіски, гарячі олії, хімічна завивка.",
          ] },
          { t: "h2", text: "Чому не варто гадати" },
          { t: "p", text: "Схоже випадіння може мати різні причини, а підходи до них різні. Визначити причину може лікар, а не косметичний догляд." },
          { t: "h2", text: "Що можна зробити самій" },
          { t: "ul", items: [
            "Записати, коли почалося і що змінювалося: хвороба, стрес, ліки, харчування, зачіски.",
            "Не стягувати волосся туго й не перегрівати його.",
            "Не починати «лікування» добавками та засобами, не порадившись із лікарем.",
          ] },
          { t: "h2", text: "Коли звернутися до лікаря" },
          { t: "ul", items: [
            "Випадіння почалося раптово або стало помітно більше звичайного.",
            "З'явилися осередки, плями без волосся.",
            "Є свербіж, біль, почервоніння або лущення шкіри голови.",
            "У жінки відступає лінія росту волосся.",
            "Випадіння дуже турбує.",
          ] },
        ],
        faq: [
          { q: "Випадіння волосся — це завжди хвороба?", a: "Ні. Щоденна втрата кількох десятків волосин — норма. Але якщо стало помітно більше або з'явилися осередки, краще звернутися до лікаря." },
          { q: "Чи допоможе нарощування приховати рідке волосся?", a: "Це залежить від причини та стану вашого волосся. Спочатку важливо з'ясувати причину; Міла обговорить це з вами на консультації." },
        ],
      },
    },
  },
  {
    slug: "normal-shedding-when-to-seek-advice", cat: "trichology", status: "draft", ownerReviewed: false, updated: "2026-11-09", minutes: 3, hub: "trichology",
    keywords: {
      ru: ["норма выпадения", "сколько волос", "нормально ли выпадение", "после стресса", "после болезни", "много волос на расчёске", "волос на расческе"],
      en: ["how many hairs", "is shedding normal", "normal shedding", "after stress", "hair on my brush"],
      uk: ["скільки волосин", "норма випадіння", "після стресу", "після хвороби", "багато волосся на гребінці"],
    },
    aiSummary: {
      ru: "Около 50–100 выпавших волос в день считается обычным. Если выпадение внезапное, очаговое или сопровождается зудом, болью и покраснением, лучше обратиться к врачу.",
      en: "Around 50–100 shed hairs a day is usual. If shedding is sudden, patchy, or comes with itching, pain or redness, it is better to see a doctor.",
      uk: "Близько 50–100 волосин на день, що випали, вважається звичайним. Якщо випадіння раптове, осередкове або супроводжується свербежем, болем і почервонінням, краще звернутися до лікаря.",
    },
    related: ["why-hair-falls-out", "can-extensions-damage-your-hair"],
    sources: [{ ...MAYO, note: "50–100 волос в день; стресс обычно даёт временное поредение; когда идти к врачу" }, { ...TE, note: "Временное диффузное выпадение после триггера" }],
    editorNotes: ["Сроки «через 2–3 месяца» и «до полугода» не включены в текст до перепроверки StatPearls.", "Утверждение Милой обязательно."],
    langs: {
      ru: {
        title: "Когда выпадение волос — норма, а когда пора к врачу",
        excerpt: "Сколько волос теряется в день, чем временное выпадение отличается от тревожного и какие признаки не стоит откладывать.",
        body: [
          { t: "h2", text: "Волосы выпадают у всех" },
          { t: "p", text: "Около 50–100 волос в день — обычная потеря. Волосы на расчёске и в стоке душа сами по себе не признак болезни: важно, заменяются ли выпавшие новыми." },
          { t: "h2", text: "Что может сделать выпадение временным" },
          { t: "p", text: "Сильный физический или эмоциональный стресс, тяжёлая болезнь и некоторые другие события могут вызвать временное поредение волос. Когда причина проходит, ситуация часто улучшается, но точные сроки и причины определяет врач." },
          { t: "h2", text: "Сигналы, которые не стоит откладывать" },
          { t: "ul", items: [
            "Выпадение началось внезапно или стало заметно больше обычного.",
            "Появились очаги и пятна без волос.",
            "Кожа головы зудит, болит, краснеет или шелушится.",
            "У женщины заметно отступает линия роста.",
          ] },
          { t: "h2", text: "Что можно сделать до визита" },
          { t: "ul", items: [
            "Записать, когда началось и что происходило в это время: болезнь, стресс, новые лекарства, смена питания.",
            "Сфотографировать проборы и линию роста при одинаковом свете, чтобы сравнивать.",
            "Бережно обращаться с волосами: без тугих причёсок и сильного нагрева.",
          ] },
        ],
        faq: [
          { q: "Сколько волос в день — норма?", a: "Около 50–100 волос в день считается обычным." },
          { q: "Нужно ли сразу идти к врачу, если волос на расчёске стало больше?", a: "Если это длится и беспокоит, а также при любых тревожных признаках из списка выше, лучше показаться врачу." },
        ],
      },
      en: {
        title: "When hair shedding is normal and when to seek advice",
        excerpt: "How many hairs are lost a day, how temporary shedding differs from a warning sign, and which signs not to postpone.",
        body: [
          { t: "h2", text: "Everyone sheds hair" },
          { t: "p", text: "About 50–100 hairs a day is a usual loss. Hairs on a brush or in the shower drain are not a sign of disease by themselves: what matters is whether shed hairs are replaced by new ones." },
          { t: "h2", text: "What can make shedding temporary" },
          { t: "p", text: "Major physical or emotional stress, a serious illness and some other events can cause temporary thinning. When the cause passes, things often improve, but exact timing and causes are for a doctor to determine." },
          { t: "h2", text: "Signs not to postpone" },
          { t: "ul", items: [
            "Shedding started suddenly or is clearly more than usual.",
            "There are patches without hair.",
            "The scalp is itchy, painful, red or flaky.",
            "A woman's hairline is clearly receding.",
          ] },
          { t: "h2", text: "What you can do before a visit" },
          { t: "ul", items: [
            "Write down when it started and what was happening: illness, stress, new medicines, a change of diet.",
            "Photograph your parting and hairline in the same light to compare.",
            "Handle your hair gently: no tight styles and no heavy heat.",
          ] },
        ],
        faq: [
          { q: "How many hairs a day is normal?", a: "About 50–100 hairs a day is considered usual." },
          { q: "Should I see a doctor as soon as I see more hair on my brush?", a: "If it continues and worries you, or if any of the warning signs above apply, it is better to see a doctor." },
        ],
      },
      uk: {
        title: "Коли випадіння волосся — норма, а коли час до лікаря",
        excerpt: "Скільки волосся втрачається на день, чим тимчасове випадіння відрізняється від тривожного та які ознаки не варто відкладати.",
        body: [
          { t: "h2", text: "Волосся випадає в усіх" },
          { t: "p", text: "Близько 50–100 волосин на день — звичайна втрата. Волосся на гребінці та в зливі душу саме по собі не ознака хвороби: важливо, чи замінюється те, що випало, новим." },
          { t: "h2", text: "Що може зробити випадіння тимчасовим" },
          { t: "p", text: "Сильний фізичний або емоційний стрес, тяжка хвороба та деякі інші події можуть викликати тимчасове рідшання волосся. Коли причина минає, ситуація часто покращується, але точні терміни й причини визначає лікар." },
          { t: "h2", text: "Сигнали, які не варто відкладати" },
          { t: "ul", items: [
            "Випадіння почалося раптово або стало помітно більше звичайного.",
            "З'явилися осередки та плями без волосся.",
            "Шкіра голови свербить, болить, червоніє або лущиться.",
            "У жінки помітно відступає лінія росту.",
          ] },
          { t: "h2", text: "Що можна зробити до візиту" },
          { t: "ul", items: [
            "Записати, коли почалося і що відбувалося в цей час: хвороба, стрес, нові ліки, зміна харчування.",
            "Сфотографувати проділ і лінію росту при однаковому світлі, щоб порівнювати.",
            "Дбайливо поводитися з волоссям: без тугих зачісок і сильного нагріву.",
          ] },
        ],
        faq: [
          { q: "Скільки волосин на день — норма?", a: "Близько 50–100 волосин на день вважається звичайним." },
          { q: "Чи потрібно одразу йти до лікаря, якщо на гребінці стало більше волосся?", a: "Якщо це триває й турбує, а також за будь-яких тривожних ознак зі списку вище, краще звернутися до лікаря." },
        ],
      },
    },
  },
  {
    slug: "can-extensions-damage-your-hair", cat: "extensions", status: "draft", ownerReviewed: false, updated: "2026-11-09", minutes: 4, hub: "extensions",
    keywords: {
      ru: ["навредить", "вредно ли наращивание", "вред наращивани", "тракц", "повредит наращивание", "портит ли наращивание", "наращивание вредит", "натяжение волос"],
      en: ["damage natural hair", "extensions damage", "are extensions bad", "traction", "extensions harm", "bad for my hair"],
      uk: ["зашкодити", "шкідливе нарощування", "шкода нарощування", "тракц", "нарощування шкодить", "натяг волосся"],
    },
    aiSummary: {
      ru: "Наращивание может вредить, если создаёт постоянное натяжение на волосы: из-за этого возможна тракционная алопеция. На ранней стадии она обычно обратима. О тянущей боли и покраснении нужно сказать мастеру и при необходимости врачу.",
      en: "Extensions can harm if they keep constant tension on the hair, which may lead to traction alopecia. In the early stage it is usually reversible. Tell your stylist, and a doctor if needed, about pulling pain or redness.",
      uk: "Нарощування може шкодити, якщо створює постійний натяг на волосся: через це можлива тракційна алопеція. На ранній стадії вона зазвичай оборотна. Про тягнучий біль і почервоніння потрібно сказати майстру та, за потреби, лікарю.",
    },
    related: ["why-hair-falls-out", "normal-shedding-when-to-seek-advice"],
    sources: [{ ...TRACTION, note: "Определение, группы риска (вплоть до накладных прядей и наращивания), ранние признаки, обратимость, профилактика" }, { ...MAYO, note: "Тугие причёски и тракционная алопеция; при рубцевании потеря может быть постоянной" }],
    editorNotes: ["Утверждение Милой обязательно; она должна добавить, как её метод снижает натяжение, — только по её подтверждению.", "Никаких заявлений «наша технология безопасна» без документов."],
    langs: {
      ru: {
        title: "Может ли наращивание навредить своим волосам",
        excerpt: "Что такое тракционная алопеция, почему постоянное натяжение опасно для волос и какие признаки нельзя игнорировать.",
        body: [
          { t: "h2", text: "Где риск" },
          { t: "p", text: "Тракционная алопеция — потеря волос из-за длительного или чрезмерного натяжения. Повторяющееся натяжение повреждает волосяные фолликулы, и со временем воспаление может привести к постоянной потере. В обзоре 2018 года среди практик с повышенным риском названы накладные пряди и наращивание, а также тугие хвосты, пучки и косы." },
          { t: "h2", text: "Ранние признаки" },
          { t: "ul", items: [
            "Участки поредения там, где волосы натянуты.",
            "Покраснение вокруг волосяных луковиц, небольшие прыщики.",
            "Обломанные волосы.",
            "Болезненность, зуд или головная боль от натяжения.",
          ] },
          { t: "h2", text: "Хорошая новость" },
          { t: "p", text: "На ранней стадии тракционная алопеция обычно обратима, если убрать натяжение. Если продолжать носить причёску, которая травмирует волосы, она может перейти в рубцовую, необратимую форму." },
          { t: "h2", text: "Как снизить риск" },
          { t: "ul", items: [
            "Сразу говорить мастеру о тянущей боли и дискомфорте.",
            "Не игнорировать покраснение и болезненность кожи головы.",
            "Не сочетать тугие причёски с химическим выпрямлением и сильным нагревом.",
            "Делать паузы и приходить на осмотр по срокам, которые назвал мастер.",
          ] },
          { t: "h2", text: "Что это значит для вас" },
          { t: "p", text: "Риск зависит от многих факторов, и подходит ли вам наращивание, лучше обсуждать на консультации, глядя на ваши собственные волосы и кожу головы. Если есть боль, воспаление или очаги, сначала обратитесь к врачу." },
        ],
        faq: [
          { q: "Наращивание всегда вредит?", a: "Нет, но постоянное натяжение — известный фактор риска. Поэтому важно, как создано и как носится наращивание." },
          { q: "Что делать, если голова болит от натяжения?", a: "Сообщите мастеру и не терпите. При покраснении, воспалении или поредении обратитесь к врачу." },
        ],
      },
      en: {
        title: "Can hair extensions damage your own hair?",
        excerpt: "What traction alopecia is, why constant tension is hard on hair, and which signs you should not ignore.",
        body: [
          { t: "h2", text: "Where the risk is" },
          { t: "p", text: "Traction alopecia is hair loss caused by prolonged or excessive pulling. Repeated tension damages hair follicles, and over time inflammation can lead to permanent loss. A 2018 review lists weaves and extensions among higher-risk practices, together with tight ponytails, buns and braids." },
          { t: "h2", text: "Early signs" },
          { t: "ul", items: [
            "Thinning in areas where the hair is under tension.",
            "Redness around follicles and small pimples.",
            "Broken hairs.",
            "Tenderness, itching or headache from the tension.",
          ] },
          { t: "h2", text: "The good news" },
          { t: "p", text: "In the early stage traction alopecia is usually reversible if the tension is removed. If a damaging hairstyle continues, it can progress to scarring, irreversible loss." },
          { t: "h2", text: "How to lower the risk" },
          { t: "ul", items: [
            "Tell your stylist at once about pulling pain or discomfort.",
            "Do not ignore redness or tenderness of the scalp.",
            "Do not combine tight styles with chemical relaxers or heavy heat.",
            "Take breaks and come for checks on the schedule your stylist gives.",
          ] },
          { t: "h2", text: "What this means for you" },
          { t: "p", text: "Risk depends on many factors, and whether extensions suit you is best discussed at a consultation, looking at your own hair and scalp. If there is pain, inflammation or patches, see a doctor first." },
        ],
        faq: [
          { q: "Do extensions always cause damage?", a: "No, but constant tension is a known risk factor. That is why it matters how extensions are made and worn." },
          { q: "What if my scalp hurts from the tension?", a: "Tell your stylist and do not put up with it. If there is redness, inflammation or thinning, see a doctor." },
        ],
      },
      uk: {
        title: "Чи може нарощування зашкодити власному волоссю",
        excerpt: "Що таке тракційна алопеція, чому постійний натяг небезпечний для волосся та які ознаки не можна ігнорувати.",
        body: [
          { t: "h2", text: "Де ризик" },
          { t: "p", text: "Тракційна алопеція — втрата волосся через тривалий або надмірний натяг. Повторюваний натяг пошкоджує волосяні фолікули, і з часом запалення може призвести до постійної втрати. В огляді 2018 року серед практик із підвищеним ризиком названо накладні пасма та нарощування, а також тугі хвости, пучки й коси." },
          { t: "h2", text: "Ранні ознаки" },
          { t: "ul", items: [
            "Ділянки рідшання там, де волосся натягнуте.",
            "Почервоніння навколо волосяних цибулин, невеликі прищики.",
            "Обламане волосся.",
            "Болючість, свербіж або головний біль від натягу.",
          ] },
          { t: "h2", text: "Добра новина" },
          { t: "p", text: "На ранній стадії тракційна алопеція зазвичай оборотна, якщо прибрати натяг. Якщо продовжувати носити зачіску, що травмує волосся, вона може перейти в рубцеву, незворотну форму." },
          { t: "h2", text: "Як знизити ризик" },
          { t: "ul", items: [
            "Одразу казати майстру про тягнучий біль і дискомфорт.",
            "Не ігнорувати почервоніння та болючість шкіри голови.",
            "Не поєднувати тугі зачіски з хімічним випрямленням і сильним нагрівом.",
            "Робити паузи й приходити на огляд у терміни, які назвав майстер.",
          ] },
          { t: "h2", text: "Що це означає для вас" },
          { t: "p", text: "Ризик залежить від багатьох чинників, і чи підходить вам нарощування, краще обговорювати на консультації, дивлячись на ваше власне волосся та шкіру голови. Якщо є біль, запалення чи осередки, спочатку зверніться до лікаря." },
        ],
        faq: [
          { q: "Нарощування завжди шкодить?", a: "Ні, але постійний натяг — відомий чинник ризику. Тому важливо, як створено та як носиться нарощування." },
          { q: "Що робити, якщо голова болить від натягу?", a: "Повідомте майстру й не терпіть. За почервоніння, запалення чи рідшання зверніться до лікаря." },
        ],
      },
    },
  },
];
