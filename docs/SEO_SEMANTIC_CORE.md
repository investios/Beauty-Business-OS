# SEO: архитектура и семантическое ядро (MK Extension Studio by Mila)

Дата: 2026-11-09. Важно: **цифр частотности здесь нет намеренно** — без инструмента (Search Console, Keyword Planner и т. п.) мы их не выдумываем. Ядро — это структура намерений и запросов; частоты добавляются после подключения инструмента.

## 1. Принципы
- Основной язык контента RU, затем EN и UA. У каждой страницы `canonical` и `hreflang` (ru, uk, en-IE, x-default → ru).
- Пока сайт демонстрационный, индексация **выключена** (`robots: noindex`, `robots.txt` запрещает всё, `sitemap.xml` пуст). Включается переменной `SITE_INDEXABLE=1` после утверждения Милой контента и юридических текстов.
- Статьи со статусом «на утверждении» остаются `noindex` даже при включённой индексации; в sitemap попадают только утверждённые.
- Разметка: `Article` и `FAQPage` (JSON-LD) на статьях; позже `LocalBusiness` — после подтверждения адреса и часов Милой.
- Медицинская осторожность: образовательный тон, не диагноз, не лечение; блок источников и пометка о проверке на каждой статье.

## 2. Структура сайта
```
/{ru|en|uk}                     главная
/about                          О Миле
/services                       обзор услуг
  /services/extensions          наращивание
  /services/trichology          трихология (консультация по уходу, не медицина)
  /services/recovery            восстановление
  /services/care                уход и поддержка
  /services/consultation        консультация
/library                        библиотека (категории: ?cat=trichology|extensions|recovery|care)
  /library/<slug>               статья
/results                        результаты (после согласий клиентов)
/contact, /book, /privacy
```
Внутренние ссылки: хаб услуги → связанные статьи; статья → хаб и запись (`/book?service=...`); статья ↔ статьи «Читайте также»; кнопка «Задать вопрос» → ИИ-консультант.

## 3. Кластеры запросов (из ТЗ)
- **A. Выпадение и поредение**: почему выпадают волосы; как остановить выпадение (формулировать как образовательный запрос, без обещаний); причины поредения; сезонное выпадение; выпадение после стресса; после родов; слабые волосы и кожа головы.
- **B. Наращивание**: самый безопасный способ; как выбрать; вредит ли своим волосам; как долго носится (нужны данные Милы); уход; наращивание на тонкие волосы.
- **C. Восстановление**: как восстановить повреждённые волосы; как уменьшить ломкость; уход за слабыми волосами; сухие и повреждённые волосы; видимость густоты.
- **D. Трихология**: когда нужна диагностика волос и кожи головы; что даёт консультация; раздражение, жирность, слабость кожи головы (образовательно).
- **E. Домашний уход**: как мыть нарощенные волосы; режим ухода; чего избегать; расчёсывание, нагрев, сон, бассейн, уход за цветом.

Локальные запросы (Дублин, Ирландия) добавляем после подтверждения адреса и услуг; формулировки — на EN и RU, в т. ч. запросы русскоязычной аудитории в Ирландии.

## 4. Карта 15–20 статей (сейчас 18)
| № | Кластер | Раздел | Тема (RU) | Тема (EN) | Основной запрос | URL | Состояние |
|---|---|---|---|---|---|---|---|
| 1 | A | trichology | Почему выпадают волосы: самые частые причины | Why hair falls out: the most common causes | why does hair fall out | `/library/why-hair-falls-out` | текст на утверждении |
| 2 | A | trichology | Когда выпадение волос — норма, а когда пора к врачу | When hair shedding is normal and when to seek advice | is hair shedding normal | `/library/normal-shedding-when-to-seek-advice` | текст на утверждении |
| 3 | B | extensions | Может ли наращивание навредить своим волосам | Can hair extensions damage your own hair? | can hair extensions damage natural hair | `/library/can-extensions-damage-your-hair` | текст на утверждении |
| 4 | B | extensions | Как безопасно выбрать способ наращивания | How to choose a hair extension method safely | safest hair extension method | `/library/choose-extension-method-safely` | тема |
| 5 | B | extensions | Наращивание на тонкие волосы: что важнее всего | Hair extensions for thin hair: what matters most | extensions for thin hair | `/library/extensions-for-thin-hair` | тема |
| 6 | D | trichology | Что может и чего не может трихологическая консультация | What a trichology consultation can and cannot do | trichology consultation what to expect | `/library/trichology-consultation-can-and-cannot` | тема |
| 7 | E | care | Как ухаживать за нарощенными волосами, чтобы они дольше выглядели красиво | How to care for extensions to keep them beautiful longer | how to care for hair extensions | `/library/extension-care-keep-beautiful` | тема |
| 8 | E | care | Частые ошибки в уходе после наращивания | Common mistakes in extension aftercare | hair extension aftercare mistakes | `/library/extension-aftercare-mistakes` | тема |
| 9 | C | recovery | Повреждённые волосы: что на самом деле значит восстановление | Damaged hair: what recovery really means | how to restore damaged hair | `/library/damaged-hair-what-recovery-means` | тема |
| 10 | A | trichology | Как стресс влияет на состояние волос | How stress affects hair condition | stress hair shedding | `/library/stress-and-hair` | тема |
| 11 | D | trichology | Густота, ломкость и здоровье кожи головы: в чём разница | Hair density, breakage and scalp health: how they differ | hair thinning vs breakage | `/library/density-breakage-scalp-health` | тема |
| 12 | C | recovery | Мифы о росте волос и «чудо-средствах» | Myths about hair growth and miracle treatments | hair growth myths | `/library/hair-growth-myths` | тема |
| 13 | E | care | Как выстроить здоровый уход за волосами | How to build a healthy hair routine | healthy hair routine | `/library/healthy-hair-routine` | тема |
| 14 | B | extensions | Что спросить перед наращиванием | What to ask before getting extensions | what to ask before hair extensions | `/library/questions-before-extensions` | тема |
| 15 | C | recovery | Экспертный гид: когда красота начинается со здоровья волос | Expert guide: when beauty goals should start with hair health | hair health before extensions | `/library/beauty-goals-start-with-hair-health` | тема |
| 16 | A | trichology | Выпадение волос после родов: что известно | Postpartum hair loss: what is known | postpartum hair loss | `/library/postpartum-hair-loss` | тема |
| 17 | E | care | Как правильно мыть нарощенные волосы | How to wash hair extensions correctly | how to wash hair extensions | `/library/how-to-wash-extensions` | тема |
| 18 | A | trichology | Сезонное выпадение волос: бывает ли оно | Seasonal hair shedding: is it real? | seasonal hair shedding | `/library/seasonal-shedding` | тема |

Порядок работы: тема → исследование источников (иерархия ниже) → черновик RU → проверка фактов → утверждение Милой → переводы EN/UA → публикация и включение в базу знаний ИИ.

## 5. Иерархия источников
1. Подтверждённая экспертиза Милы. 2. Документация производителя (если упоминаются средства/приборы). 3. Медицинские и университетские источники, профильные ассоциации, рецензируемые работы. 4. Общие объясняющие источники (осторожно).
Каждая статья хранит список источников с уровнем (`tier`), дату обновления, статус «утверждено/на утверждении» и заметки редактора (`editorNotes`).

## 6. Связь с ИИ-консультантом
Статьи содержат ключевые слова на трёх языках и короткую выжимку (`aiSummary`). Консультант по вопросу подбирает статью, отвечает выжимкой + ссылка + предложение консультации. Диагнозов и обещаний нет; боль, воспаление, очаги, внезапное сильное выпадение — передача мастеру. Пока статья не утверждена, ИИ прямо пишет об этом.

## 7. Еженедельный мониторинг (задел)
В модели статьи есть дата обновления и заметки редактора. Следующий шаг — тип «Обновление исследований» и еженедельная подборка новых работ с пометкой «проверить»; без автопубликации.

## 8. Что нужно для запуска индексации
Утверждённые Милой тексты; адрес/часы; юридическая проверка политики конфиденциальности и cookie-согласия; Search Console; метрики (аналитика только с согласия).
