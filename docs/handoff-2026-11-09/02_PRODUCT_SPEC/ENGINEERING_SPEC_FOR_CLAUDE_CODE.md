# ТЕХНИЧЕСКОЕ ЗАДАНИЕ ДЛЯ CLAUDE CODE

**9 ноября 2026 · версия 0.2 · первый beauty-салон**
**Документ предназначен для разработки, не является обещанием уже подключённых интеграций.** Действует вместе с `Current_Product_Architecture_v0.1.md`, `DESIGN_SYSTEM_AND_UX_BRIEF.md` и `ACCEPTANCE_AND_TESTS.md`.

## 0. Mission / Definition of done
Создать продуманный, продающий, быстрый мобильный сайт и единую систему управления обращениями/записью для пилотного мастера по волосам в Ирландии. AI — эксперт-консультант первой линии по утверждённым знаниям мастера, умеющий правильно предложить запись и вызывать серверные инструменты. Клиент может записаться и без AI. Мастер с телефона видит все записи и исключения. Отдельный оператор может обучать AI и решать проблемы подключения.

**Сегодняшний deliverable:** интерактивный прототип. **Production delivery:** по этапам ниже, после получения реальных данных, прав доступа и договора с владельцем.

## 1. Non-negotiable UX and functional behavior
1. Главный экран показывает brand story, конкретную услугу/результаты, CTA Book и Ask AI. AI не открывается сам без согласия.
2. Instagram-first: клиент уже видел работы. Ссылки с UTM открывают нужную услугу/оффер; Direct при официальной интеграции может пройти консультацию/запись без сайта.
3. Клиент выбирает время без обязательной регистрации. Окна только реальные и учитывают услугу/мастера/ресурс/буферы. Защита от двойной записи.
4. AI отвечает прямо на запрос; цена берётся из таблицы/правил, неизвестное обозначается неизвестным. После уместного уточнения предлагает слот. Сложные ситуации -> human handoff.
5. Мультиязычность контента/диалога EN/UA/RU, языки не смешивать в одном сообщении без причины.
6. У каждого обращения source/medium/campaign/content, first-touch/last-touch по мере технической доступности.
7. После подтверждения сервис уведомляет о событии, затем reminder и follow-up по допустимым условиям; marketing separate opt-in.
8. Владелец видит Today/Week, bookings, client history, AI exceptions, marketing 4 core automations, metrics.
9. Платформа tenant-scoped; разные салоны не делятся CRM-клиентами. Операторский доступ проверяемый и журналируемый.

## 2. Слои приложения и рекомендуемый стек
**Web:** Next.js 15+/React, TypeScript strict, Tailwind/CSS variables, server components where useful, accessible Headless UI primitives; next-intl или аналог.
**API:** TypeScript backend (Next route handlers для пилота или отдельный Node/Nest/Fastify), Zod + JSON schema validation; OpenAPI 3.1 контракт.
**DB:** PostgreSQL; Prisma/Drizzle для схемы и миграций. Транзакции/locks на бронирования, unique exclusion constraints или эквивалент. **Queue:** Redis/BullMQ/managed queue для webhook и напоминаний. **Storage:** object storage с signed URLs для изображений. **Auth:** secure owner/operator auth, guest booking tokens, RBAC.
**AI:** pluggable provider adapter + approved KB retrieval + tool gateway + quality eval; secrets только на сервере; tool results schema-validated.
**Telemetry:** structured logs, correlation IDs, audit of mutations, Sentry/OpenTelemetry option; no PII in logs by default.
**Deployment:** staging/prod separation, migrations, CI lint/typecheck/test; environment secrets via deployment secret store; backups + recovery strategy.
**Важно:** это рекомендуемый стек, Claude Code может предложить эквивалент, но должен объяснить отличие и не сломать data invariants.

## 3. Структура репозитория (рекомендация)
```text
apps/
  web/                 # storefront, services, book, consult, EN/UA/RU
  owner/               # owner PWA dashboard
  operator/            # onboarding, integrations, KB approval, exceptions
  api/                 # if separated; booking, CRM, AI, automations
packages/
  domain/              # typed entities and state transitions
  ui/                  # shared primitives + brandable tokens
  booking/             # slot calculation, validation, atomic reserves
  ai/                  # policy, expert knowledge, tools, eval
  integrations/        # verified webhooks, provider adapters
  marketing/           # campaigns, tracking, rebook, referral
  i18n/                # translations and locale-aware formatting
  config/              # lint, tsconfig, env parsing
prisma/ or drizzle/; tests/; docs/; scripts/
```

## 4. Три роли / права
**Guest client:** GET public data; public FAQ/AI subject to rate limits; create/modify own appointment through signed limited-scope link; not read other records.
**Staff/Owner:** own tenant appointments/clients/settings/KB drafts; owner approves published knowledge, communications and staff roles.
**Platform operator:** scope-based customer support access with reason + audit; never automatically broad access to full personal data, secrets or financial information.
**Platform admin:** tenant provisioning and billing metadata, but access to private client data only via explicit authorization and minimal scoped role.

## 5. Данные (минимальная схема)
| Entity | Essential fields | Constraints |
|---|---|---|
| Tenant | id, slug, locale, timezone, brandTheme, status | tenant isolation |
| Location | id, tenantId, address, tz, openingHours | timezone IANA |
| Staff | id, tenantId, roles, serviceIds, availability | capability-based access |
| Service | id, tenantId, titleI18n, descriptionI18n, durationMin, bufferMin, displayPriceMode, priceFrom, qualificationRequired, active | no invented price |
| Resource | id, tenantId, type, capacity, availability | exclusivity |
| Client | id, tenantId, contacts, preferredLocale, preferredChannel, createdFrom, privacy flags | encrypted sensitive columns |
| Conversation | id, tenantId, clientId?, source, campaignId?, channel, identityConfidence, state | no auto merge across people |
| Message | id, conversationId, role, content, knowledgeVersion, toolActions, consentRecord | retention policy |
| KnowledgeArticle | id, tenantId, serviceId?, title, body, allowedClaims, prohibitedClaims | draft/approved/published |
| KnowledgeVersion | id, tenantId, version, approvedBy, approvedAt, createdAt | immutable published snapshots |
| Appointment | id, tenantId, clientId, staffId, serviceId, startAtUtc, endAtUtc, status, holdExpiresAt, sourceId, version | atomic overlap protection |
| AvailabilityRule | id, tenantId, staffId, rrule, exceptions, buffers | daylight saving |
| WaitlistEntry | id, clientId, constraints, status, expiresAt | bounded notifications |
| Consent | id, tenantId, clientId, channel, purpose, version, grantedAt, withdrawnAt, proof | marketing separated |
| Referral | id, referrer, invitee, campaignId, status, rewardAt | no self-referral |
| LoyaltyLedger | id, tenantId, clientId, action, points, expiresAt, reversedAt | auditable |
| Campaign | id, tenantId, landingId, channel, frontProduct, UTM, creativeId, status | attribution |
| AutomationRun | id, tenantId, type, triggerEventId, status, retries, result | idempotency |
| AuditEvent | actor, tenantId, action, target, correlationId, diff, at | immutable retention |

**Optional advanced:** payments, salon staff shifts, marketing aggregate, actual revenue/COGS, engagement; avoid prematurely adding payroll/HR/finance Business OS.

## 6. Главные маршруты/экраны
Public: `/[locale]`, `/[locale]/services`, `/[locale]/services/[slug]`, `/[locale]/about`, `/[locale]/portfolio`, `/[locale]/reviews`, `/[locale]/book`, `/[locale]/consult`, `/[locale]/contact`, `/[locale]/privacy`, `/[locale]/terms`.
Owner: `/owner/today`, `/owner/calendar`, `/owner/clients/[id]`, `/owner/ai/knowledge`, `/owner/ai/review`, `/owner/marketing`, `/owner/analytics`, `/owner/settings`.
Operator (later): `/ops/tenants/[id]`, `/ops/integrations`, `/ops/ai-qa`, `/ops/errors`.

## 7. API endpoints (proposed JSON; RBAC and tenant scope mandatory)
```http
GET    /api/v1/public/:tenant/services
GET    /api/v1/public/:tenant/availability?serviceId=&from=&to=&staffId=
POST   /api/v1/public/:tenant/booking-holds
POST   /api/v1/public/:tenant/bookings
GET    /api/v1/bookings/:id
POST   /api/v1/bookings/:id/reschedule
POST   /api/v1/bookings/:id/cancel
POST   /api/v1/public/:tenant/ai/conversations
POST   /api/v1/ai/conversations/:id/messages
POST   /api/v1/ai/conversations/:id/handoff
GET    /api/v1/owner/today
GET    /api/v1/owner/clients/:id
POST   /api/v1/owner/knowledge/drafts
POST   /api/v1/owner/knowledge/:id/approve
POST   /api/v1/owner/knowledge/:id/publish
POST   /api/v1/owner/marketing/automations/:id/enable
POST   /api/v1/webhooks/:provider
GET    /api/v1/health; GET /api/v1/ready
```
`POST bookings` request: `{ serviceId, staffId?, startsAtUtc, client:{name,contact,locale}, idempotencyKey, consentIds, holdId? }`. Return `{ appointmentId, status, serverStartAtUtc, timezone, confirmationDeliveryStatus }`. If booking cannot be completed, return specific error and alternative slots — no silent fallback to 'confirmed'.
`POST AI messages`: `{ conversationId, text, locale, sourceContext }` -> `{ message, citationsToKnowledgeIds?, actionProposal?, executedToolResults?, requiresHuman, handoffReason? }`. UI must wait for verified tool results.

## 8. Booking design: atomicity & DST
Store UTC instants, display in `Europe/Dublin`; calendar uses actual zoned local dates. Opening hours and RRULE local to venue, convert after DST rules are applied; never use fixed UTC offset for recurring slots. Concurrent booking tests for same staff/resource: only one success. `held` expires safely; cancel/rebook atomic with optimistic version or transaction; idempotency key prevents duplicated slots from network retries. Distinguish `requested`, `held`, `confirmed`, `completed`, `cancelled`, `no_show`. Only confirmed enters final state after deposit conditions (if any) are satisfied.

## 9. Expert AI / tools / guardrails
AI state machine: `IDENTIFY_INTENT -> ANSWER/ASK_ONE_QUESTION -> ADVISE_IN_SCOPE -> OFFER_CONSULTATION_OR_SLOT -> TOOL_ACTION -> CONFIRM_OR_ESCALATE`.
Retrieve only approved current articles, service rules, policies, booking API and available media. No invented price/treatment claims, no diagnosis. Identify as AI upfront; explicit data handling message; user can request human. Rate limits and abuse handling. Tool actions have explicit types and server-side precondition checks: `getServices`, `getAvailability`, `createHold`, `createBooking`, `requestHandoff`, `createLead`, `sendServiceMessage`. Sensitive/monetary mutations require checks and sometimes user confirmation. Use eval set: 30–50 anonymized real inquiries, plus synthetic edge cases. Store prompt + knowledge version for QA (without unnecessary sensitive payloads).

## 10. Marketing and triggers
Event bus types: `lead.created`, `message.received`, `comment.eligible`, `conversation.handoff`, `booking.held`, `booking.confirmed`, `booking.cancelled`, `visit.completed`, `rebooking.due`, `referral.qualified`, `consent.withdrawn`. Each automation must have trigger, predicates, legal channel, frequency cap, idempotency, trace, opt-out and manual stop. Four core campaigns: rebook, referral, waitlist, reactivation. Source tracking from URL params/official channel metadata; server-side record only when lawful; Google Business links and QR.

## 11. Integration adapters
Provider interface: `verifyWebhook(signature, headers, body)`, `parseEvent`, `canReply`, `sendMessage`, `getDeliveryStatus`, `getCapabilities(tenantAccount)`. Never rely on scraped/private APIs. New service capability flags determine UI availability. No fake 'Instagram connected' checkmarks.

## 12. Notifications
Transactional: booking confirmed/modified/cancelled, pre-visit reminders, preparation details. Marketing: promos/referrals/reactivation only when legally permitted; purpose-specific preferences and suppressions. If provider unavailable, queue with retry and operator alert; distinguish `queued/sent/delivered/failed` from `read`. External SMS/voice costs configurable and audited. Preview/approval when launching campaigns.

## 13. Security and privacy
Consent and privacy-first data minimization. No secrets in browser/LLM prompts. Data protection impact triage for optional photos/health-related responses. AI disclosure; no public storage of sensitive intake data. HTTPS, CSRF protections, verified webhook signatures, RBAC, encryption at rest/in transit, PII masking, deletion/export, data retention, DPA with processors and opt-out. Audit manual edits to booking, payments, content knowledge. GDPR/Irish electronic marketing and API policies need specialist validation before live launch.

## 14. MVP work packages
**P0.0 Demo:** static site using demo image placeholders + scripted chat + localStorage booking owner dashboard; clearly marked fake data. No auth/real backend in prototype.
**P0.1 Foundation:** repo, i18n, theme system, CI, data entities, auth tenant.
**P0.2 Public:** public pages, SEO/schema.org only with confirmed details, media consent, fast mobile pages, contact/FAQ.
**P0.3 Booking:** API, slot engine, transaction, owner calendar, booking links, reminders stubs.
**P0.4 AI:** KB onboarding, approved/rollback, policy engine, actions, handoff, QA.
**P0.5 CRM:** client history, source tracking, language, consent, notes.
**P0.6 Notifications:** transactional sends and logs, safe retries.
**P0.7 Production gate:** security, privacy, backups, staging smoke, integration verification.
**P1 Growth:** referrals, waitlist, automated rebook/reactivation, official Instagram, campaign analytics, second staff.

## 15. Constraints and explicit non-goals
Not building our consultant acquisition funnel today; not building standalone Business OS; no automatic outreach for likes; no medical efficacy claims without expert-approved content; no assumption that TikTok API works in Ireland; no live phone bot on demo day; no paid WhatsApp/SMS until legal/API/tariff verification.

## 16. Handoff format from Claude Code
Developer should return: `README.md`, architecture diagram, schema/migrations, env example, API docs, relevant test results, list of stubbed integrations, migration from demo UI to production modules, screenshots desktop + iPhone widths (375/390/430), and deployment instructions. Track unresolved decisions in `docs/DECISIONS.md` and `docs/BACKLOG.md`, do not silently invent facts.
