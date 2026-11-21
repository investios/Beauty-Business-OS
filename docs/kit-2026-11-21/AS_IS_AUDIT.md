# AS_IS_AUDIT — Beauty OS vs комплект v3.1 (21.11.2026)

Аудит текущего кода (коммит cbfd3d6) по 42 процессам комплекта. Статусы поставлены по коду и тестам, а не по ощущению: ссылка на файл/тест в каждой строке. Живой реальной отправки писем/сообщений нет нигде, это честно отмечено как NOT_CONNECTED.

## Сводка по статусам

| Статус | Сколько |
|---|---|
| MISSING | 5 |
| NOT_CONNECTED | 1 |
| PARTIAL | 28 |
| VERIFIED_WORKING | 8 |

Всего процессов: 42.

## Как читать
VERIFIED_WORKING — работает и есть тест; PARTIAL — часть есть, часть нет; MISSING — в коде нет; NOT_CONNECTED — написано, но канала/провайдера нет; DEFERRED — ждёт решения владельца.

## Таблица (полная версия с доказательствами — REQUIREMENT_TRACEABILITY.csv)

| ID | Процесс | Статус | Приор. | Что есть | Чего не хватает | Патч | Тест/доказательство |
|---|---|---|---|---|---|---|---|
| CJ01 | Вход: Google, соцсети, рекомендации, статьи | PARTIAL | P1 | UTM и ref первого касания сохраняются; библиотека статей; SEO по умолчанию noindex | Нет подключённых Google Business/соцсетей; нет связки статья→запись как отдельного события | Событие «источник» уже есть; добавить только отчёт по статье→запись (позже) | tests/pr4 (e2e pr4.cjs), journey.cjs; src/lib/client.ts, src/lib/library.ts, src/app/[locale]/library |
| CJ02 | Квалификация и консультация до записи | PARTIAL | P1 | ai.ts classify (12 намерений), llm.ts с утверждённой базой знаний, handoff при медицине | Нет явного состояния беседы (стадия воронки), нет сохранённых ответов квалификации | conversation_state (миграция 0015), стадия видна в «ИИ и вопросы» | tests/ai.test.ts; src/lib/ai.ts, src/lib/llm.ts, src/app/owner/ai/page.tsx |
| CJ03 | Выбор услуги и живого слота | VERIFIED_WORKING | P0 | Единый движок booking.ts, триггер slot_overlap в БД, календарь/исключения/график, лист ожидания | Буфер один (buffer_min), нет раздельно «до»/«после» | Добавить buffer_before/after в service_rules (аддитивно) — P0 | tests/booking.test.ts, calendar.test.ts, schedule.test.ts, horizon.test.ts; src/lib/booking.ts, src/lib/calendar.ts, migrations/0001,0004,0005 |
| CJ04 | Бронь, согласие, подтверждение доставки | PARTIAL | P0 | Бронь фиксируется транзакционно; таблица consents (service/marketing); снимок условий appointment_terms | Письмо-подтверждение НЕ уходит (EMAIL_PROVIDER не подключён); статусы доставки только not_configured/sent/failed | Расширить статусы доставки queued/sent/delivered/failed/suppressed; реальная отправка остаётся заблокированной (D02) | tests/lifecycle.test.ts, pr2.test.ts; src/lib/notify.ts, src/lib/lifecycle.ts, migrations/0006 |
| CJ05 | Подготовка, напоминания, изменение планов | PARTIAL | P0 | Шаблоны 7 видов RU/EN/UK, политики напоминаний, ссылка управления записью, отмена/перенос с лимитом 12 ч, позднее изменение → вопрос мастеру | Реальной отправки нет; нет cron (D-19); подготовка к услуге не привязана к услуге | Cron — ждёт разрешения владельца; prep-тексты в каталог услуг | tests/lifecycle.test.ts, late-change.test.ts, policies.test.ts; src/lib/lifecycle-templates.ts, src/lib/late-change.ts, src/lib/jobs.ts |
| CJ06 | День визита: опоздание, неявка, завершение | PARTIAL | P1 | Статусы completed/no_show ставит мастер; влияют на цикл и бонусы | Нет сценария «опаздываю» от клиента; нет авто-подсказки мастеру | Тип обращения «опаздываю» → мастеру без прерывания | tests/loyalty.test.ts; src/app/owner/appointments/[id]/page.tsx, src/app/owner/actions.ts |
| CJ07 | После визита: обратная связь, отзыв, повторная запись | PARTIAL | P0 | followup (24 ч) и rebook шаблоны; таблицы complaints/reviews; нейтральная ссылка | Тексты follow-up общие (не схема 1/2/3); при жалобе цепочка продаж не останавливается автоматически | SC15-схема (черновик, утверждает мастер); complaint → suppress (конфликт с кампаниями) | tests/lifecycle.test.ts, client-model.test.ts; src/lib/lifecycle-templates.ts, src/lib/client-model.ts |
| AI01 | Классификатор обращения и режимы разрешений | VERIFIED_WORKING | P0 | Матрица auto/confirm/master (ai-tools.ts), аудит вызовов, пробный прогон на сценариях | Нет ярлыка срочности «verified urgent» отдельно от слова клиента | urgency_verified в handoff | tests/ai-actions.test.ts, ai.test.ts; src/lib/ai-tools.ts, src/lib/ai-actions.ts |
| AI02 | Идентификация и защита действий клиента | VERIFIED_WORKING | P1 | Узнавание только по подписанной ссылке; скидки/цены/VIP — только мастер | Нет объединения дублей клиентов (merge) | Ручной merge с журналом — P1 | tests/ai-recognition.test.ts; src/lib/client-context.ts |
| AI03 | Очередь вопросов мастеру без прерывания процедур | PARTIAL | P0 | Список передач (handoffs) в «ИИ и вопросы», ответ мастера, VIP-срочно не прерывает | Нет состояний мастера (в процедуре/перерыв/выключен/не беспокоить), нет пакетной выдачи и SLA | master_state + окно перерыва; очередь показывается пачкой — P0 | tests/master-replies.test.ts; src/app/owner/ai/page.tsx, src/lib/master-replies.ts |
| AI04 | Вечерний операционный брифинг | PARTIAL | P0 | Сводка на завтра строится и сохраняется (daily_briefs), задача evening_brief, показ в «Сегодня» | Время не выбирается мастером; доставки наружу нет (D12) | Настройка времени брифа (policy) + статус «не доставлено наружу» | tests/jobs.test.ts, owner-queries.test.ts; src/lib/brief.ts, src/lib/jobs.ts |
| AI05 | Голосовой ассистент | PARTIAL | P1 | Голосовой ввод в браузере (VoiceField), голосовая озвучка сводки, помощник владельца | Нет цепочки превью→подтверждение→исполнение для голосовых команд изменения данных | Двухфазное действие (preview/confirm) для владельца — P1 | tests/owner-assistant.test.ts; src/components/VoiceField.tsx, src/lib/owner-assistant.ts |
| AI06 | Обучение ИИ и утверждение знаний | PARTIAL | P1 | ai-knowledge.ts, статьи библиотеки, owner/library | Нет версий/публикации/отката ответов, нет списка запрещённых утверждений в UI | approved_claim_registry (миграция 0015) — Sales Lite | tests/ai.test.ts; src/lib/ai-knowledge.ts, src/app/owner/library |
| AI07 | Рабочее качество и контроль ИИ | PARTIAL | P1 | llm-eval.cjs (набор проверок), аудит инструментов | Нет рубрики R01–R10 и прогона сценариев | Sales evaluation (SALES_TEST_MATRIX) — D-поток | tests/e2e/llm-eval.cjs; tests/e2e/llm-eval.cjs |
| CRM01 | Единая карточка и подтверждённая идентичность | PARTIAL | P0 | Карточка клиента, заметки, статусы, предпочтительный канал | Нет merge/dedupe; нет записи о версии согласия | client_consent с версией текста — P0 (часть согласий) | tests/client-model.test.ts; src/app/owner/clients/[id]/page.tsx |
| CRM02 | Услуги, варианты, прайс, снимок записи | PARTIAL | P1 | Таблица services, price_mode (unconfirmed/from/fixed/range), снимок условий | Нет CRUD услуг в кабинете, вариантов, 3 языков в UI, on-consultation, подготовки/ухода, цикла на услугу | Каталог услуг: редактирование + repeat_interval (service_rules) — P1; цены не придумывать (D01) | tests/booking.test.ts; migrations/0001, 0005; src/lib/service-rules.ts |
| CRM03 | История процедур и профессиональные заметки | VERIFIED_WORKING | P1 | client_notes с категориями, история записей в карточке | Нет вложений/фото | — | tests/client-model.test.ts; src/lib/client-model.ts |
| CRM04 | Цикл возврата и сегментация состояния | PARTIAL | P1 | Статусы active/overdue/at_risk/lost/inactive/archived; журнал смены | Цикл общий (28 д тест), нет «Приближается» и цикла на услугу/клиента | Per-service interval + статус approaching — P1 (приоритет P0 для цикла по услуге) | tests/client-model.test.ts; src/lib/client-model.ts, src/lib/policies.ts |
| CRM05 | Бонусы, срок действия, рефералы | PARTIAL | P1 | Журнал в центах, идемпотентно, реферал после состоявшегося визита, антисамореферал | Нет срока действия бонусов (1.5× интервала); значения — тестовые | expires_at в леджере (аддитивно, D04 по округлению) — P1 | tests/loyalty.test.ts; src/lib/loyalty.ts, migrations/0013 |
| CRM06 | VIP / Gold | PARTIAL | DEFERRED→D05 | Ручной VIP, запрос срочного окна, резерв % в политике (0 по умолчанию), освобождение 48 ч | Динамического расчёта нет (формула не согласована, D05) | Не делать без решения владельца | tests/loyalty.test.ts; src/lib/loyalty.ts |
| CRM07 | Жалобы, внутренние отзывы, честная репутация | PARTIAL | P0 | Таблицы complaints/reviews, форма в карточке | Жалоба не останавливает автоматические сообщения; нет стадий и SLA | Флаг complaint_open → блок follow-up/rebook/кампаний — P0 | tests/client-model.test.ts; src/lib/client-model.ts |
| MKT01 | Sales Lite: намерение → ценность → шаг | PARTIAL | P1 | Классификатор, ответы по базе знаний, 12 намерений | Нет библиотеки сценариев SC01–SC30, нет conversation_state и контрольного паспорта | Отдельный поток D (реестры + flag, не live) | нет — создаётся; src/lib/ai.ts, docs/SALES_COMM_AUDIT_2026-11-21.md |
| MKT02 | Событие: опубликована статья | MISSING | P1 | Статьи есть, события публикации нет | Нет контент-событий и кампаний | content_event + черновик кампании (без отправки) — P1 | нет; src/lib/library.ts |
| MKT03 | Новая услуга/акция → кампания | MISSING | P1 | — | Нет кампаний, согласия, предпросмотра/утверждения | campaigns draft→approval, отправка заблокирована | нет; — |
| MKT04 | Ежемесячный дайджест | MISSING | P1 | — | Нет | Каркас, пустой дайджест пропускается; без отправки | нет; — |
| MKT05 | Сегменты, согласия, частота, отписка | PARTIAL | P0 | consents (service/marketing), статусы клиентов, 4 переключателя автоматизаций (только сохраняют выбор) | Нет отписки, suppression, лимитов частоты, deliverability | suppression + frequency cap в плане отправки — P0/P1 | tests/lifecycle.test.ts; migrations/0001 (consents), src/app/owner/marketing/page.tsx |
| MKT06 | Клиентский опыт, честные отзывы, рекомендации | PARTIAL | P1 | Реферальная ссылка, нейтральный follow-up (черновик) | Нет ссылки на реальный отзыв (URL не дан); нет правила «без вознаграждений за отзывы» в коде как проверки | Автопроверка текстов на запрещённые формулировки (в QA) | tests/lifecycle.test.ts; src/lib/lifecycle-templates.ts |
| MKT07 | Результаты маркетинга | PARTIAL | E | Отчёт по источникам, консультант (агрегаты) | Нет конверсии кампаний | — | tests/consultant.test.ts; src/app/owner/marketing/page.tsx, src/lib/consulting.ts |
| OWN01 | Первый запуск, реальные данные мастера | PARTIAL | P1 | Сид-данные с пометкой is_placeholder; анкета вопросов Миле (docs/QUESTIONS_FOR_MILA.md) | Нет мастера первого запуска в кабинете | — | —; src/lib/seed.ts |
| OWN02 | Календарь и управление временем | VERIFIED_WORKING | P0 | Расписание, исключения, перерывы, горизонт, ручное закрытие | — | — | tests/e2e/calendar-owner.cjs, schedule.test.ts; src/app/owner/schedule, calendar |
| OWN03 | Главный экран: сегодня, завтра, вопросы | VERIFIED_WORKING | P0 | Обзор, Сегодня, Последние действия, ярлыки | Нет индикатора состояния мастера | Индикатор state вместе с AI03 | tests/e2e/dashboard.cjs; src/app/owner/page.tsx, today |
| OWN04 | Каталог настроек | PARTIAL | P1 | policies с версиями, реестр настроек (docs/SETTINGS_REGISTRY) | Нет UI для большинства групп (услуги, бренд, связь, Sales Lite) | Расширять по мере модулей | tests/policies.test.ts; src/app/owner/settings |
| OWN05 | Письма и контентные кампании | MISSING | P1 | Только переключатели автоматизаций | Нет | См. MKT03 | нет; — |
| OWN06 | Техподдержка: заявка и статус | MISSING | P1 | Консультант-заметки есть; тикетов нет | Нет support_ticket | support_tickets с состояниями — P1 | нет; src/lib/consulting.ts |
| OWN07 | Кто что видит | PARTIAL | P0 | Владелец и консультант (агрегаты), отдельные куки | Нет 2FA; нет роли разработчика/поддержки | 2FA — перед публичным коммерческим запуском (не заявлять) | tests/consultant.test.ts, auth.test.ts; src/lib/auth.ts |
| TECH01 | Разбор репозитория, минимальные изменения | VERIFIED_WORKING | P0 | Этот аудит; аддитивные миграции | — | — | —; docs/ |
| TECH02 | Мультиканальные адаптеры | NOT_CONNECTED | P0 | Единая точка notify.ts; каналы в карточке клиента как предпочтение | Ни один реальный канал не подключён; провайдер/домен не выбраны (D02/D03) | Интерфейс адаптера + mock и real отдельно; real заблокирован | tests/lifecycle.test.ts; src/lib/notify.ts, docs/INTEGRATIONS_RESEARCH_2026-11-20.md |
| TECH03 | Фоновые задачи, идемпотентность, время | PARTIAL | P0 | jobs: run_key UNIQUE, 3 попытки, backoff 10 мин, tick под секретом, Europe/Dublin | Нет автозапуска (cron), нет DLQ-списка, нет аварийной очереди в UI | Список «провалившихся» в Сегодня; cron — после разрешения | tests/jobs.test.ts, tz.test.ts; src/lib/jobs.ts, src/app/api/v1/cron/tick |
| TECH04 | Модель данных и защитные контуры | PARTIAL | P0 | tenant_id везде, audit_events, тайм-лимит входа, rate limit, секреты в Secrets | Нет шифрования заметок «здоровье», нет политики хранения/удаления | Политика удаления/экспорта — документ + задача | tests/auth.test.ts, login-throttle.test.ts; migrations/0001, src/lib/ratelimit.ts |
| TECH05 | Мониторинг и сводка разработчику | PARTIAL | E | /api/v1/health | Нет ежедневной сводки | — | —; src/app/api/v1/health |
| TECH06 | Качество и многосценарные тесты | PARTIAL | P0 | 177 unit-тестов, ~20 e2e-скриптов | Нет матрицы AT01–AT25 в явном виде | E2E_TEST_REPORT.md с честными PASS/FAIL/BLOCKED | vitest; tests/ |
| TECH07 | MVP-границы и будущие пакеты | VERIFIED_WORKING | E | docs/MVP_READINESS, DEFERRED_BACKLOG | — | Привязать к E-списку комплекта | —; docs/ |

## Главные выводы

1. Ядро записи (движок, календарь, политики, бонусы, задачи) рабочее и покрыто тестами — его не трогаем.
2. Ни одно сообщение клиенту реально не уходит: нет домена и почтового провайдера (D02/D03). Все «отправлено» в интерфейсе — только записанный статус.
3. P0-пробелы к закрытию: состояния мастера и пачка вопросов (AI03), время вечернего брифа (AI04), расширенные статусы доставки (CJ04), блок цепочек при открытой жалобе (CRM07), версии согласий и отписка/suppression (CRM01/MKT05), буфер до/после (CJ03), список провалившихся задач (TECH03).
4. P1: каталог услуг и цикл на услугу, срок бонусов, поддержка, контент-кампании (без отправки), Sales Lite.
5. Не делаем без решения владельца: динамический VIP (D05), цены, скидки, реальные рассылки.

## Что не проверено
Миграция 0006 в боевой D1 не подтверждена; 2FA нет; мобильная проверка голоса на iPhone — на стороне владельца.