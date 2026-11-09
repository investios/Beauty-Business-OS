# ИНТЕГРАЦИИ: МАТРИЦА ВОЗМОЖНОСТЕЙ И ЗАВИСИМОСТЕЙ

**Важно:** значения «planned» — архитектурный план, а не подключение. Перед реальным запуском перепроверить актуальные условия провайдеров, права аккаунтов, стоимость, доступность по стране и compliance.

| Канал/сервис | Для чего нужен | Приоритет | Состояние для демо | Предпосылки для production | Риски и ограничения |
|---|---|---|---|---|---|
| Website chat | FAQ/AI/booking | P0 | scripted dialogue | LLM backend + KB + privacy + limits | ответы только из approved KB |
| Booking engine | слоты, бронь, перенос | P0 | localStorage mock | PostgreSQL, atomicity, timezone, auth | двойная бронь, DST |
| Owner dashboard | календарь, CRM, исключения | P0 | demo UI | role auth, DB, audit | персональные данные |
| Email provider | booking/reminders | P0 | on-screen sample | domain auth SPF/DKIM/DMARC, templates | доставляемость |
| SMS gateway | reminders/OTP | P1 | не подключён | provider, consent logic, price caps | costs, opt out |
| Instagram Messaging API | DM & supported interactions | P1 | schematic only | professional account, Meta app/review, permissions, connected business setup, webhooks | messaging windows, private reply rules |
| Meta ads click-to-message | рекламные лиды | P1 | funnel UI | ad account, consent rules, CTA trigger, conversion API where allowed | click ≠ DM permission |
| Facebook Messenger | сообщения, рекламные реакции | P1 | нет | Meta app + pages permissions + webhooks | messaging policies vary |
| Manychat or adapter | channel bridge, comment triggers | optional P1 | not connected | supported account, subscriptions, capability tests | vendor dependency and pricing |
| WhatsApp Business Platform | сообщения / шаблоны | P1/P2 | нет | official Business Platform, account, approved templates, opt-in, cost | 24-hour window and template rules |
| Google Business Profile | booking links, local listing | P1 | external link placeholder | verified GBP, owner permission | no unverified review manipulation |
| Google Calendar | external calendar sync | P1 | no | OAuth, conflict model, sync health, rate limits | one source of truth in platform |
| Payments (Stripe etc.) | deposits/booking fees | P1 | none | merchant KYB, payment terms, refund logic, PCI delegation | refund disputes |
| Facebook/Instagram advertising APIs | campaign attribution/launch | P2 | no | explicit business access and review | avoid unrealistic automated ads claims |
| TikTok Messaging/ads | leads on TikTok | P2/backlog | no | **verify Ireland/EU availability** and supported API for account | do not promise integration |
| Voice telephony | AI callback, phone | P2/backlog | no | phone provider, consent, recording disclosure, billing, QA | cost / privacy / hallucination |
| Web analytics | traffic attribution | P0/P1 | synthetic source parameter | privacy-safe analytics and consent where required | attribution uncertainty |
| Loyalty/partner QR | referral codes | P1 | conceptual | CRM, fraud controls, voucher ledger | no sharing clients without consent |

## Common adapter contract
Provider event → signature verification → tenant/account scope validation → idempotency key → persisted normalized event → background queue → policy gate → context lookup → AI/booking action → provider send → delivery status & audit.

Types: `ChannelEvent { eventId, provider, tenantId, externalUserId, channel, eventType, receivedAt, payloadRef, allowedResponseType, sourceCampaignId? }`.

Capability registry: `can_receive_dms`, `can_send_reply`, `can_send_template`, `supports_comment_private_reply`, `supports_click_to_message`, `can_provide_identity`, `supports_media`, `window_ends_at`. Never guess capabilities from brand alone; read account-validated status.

## Consent/channel windows
Service notifications and direct marketing tracked separately. Facebook/Instagram and WhatsApp conversation windows differ; store `last_inbound_at`, enforce channel policy per provider. Private replies to comments can have special limits. A like cannot automatically create a permitted private DM. For cross-channel conversation merge, verify user identity and permissions.

## Integration release checklist
Actual credentials connected on STAGING, webhook signature negative test, token expiry/refresh test, duplicate event test, failure/retry/dead letter, rate limiting, unsubscribe, server-side action confirmation, message logging privacy review, invoice and provider expense transparency, one-click disable per tenant.
