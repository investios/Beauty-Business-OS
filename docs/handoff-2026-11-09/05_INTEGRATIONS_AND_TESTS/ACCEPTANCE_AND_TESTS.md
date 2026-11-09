# ПРИЁМКА · UX / BOOKING / AI / CRM / INTEGRATIONS

## P0 user journeys
1. Client opens homepage at 390px width, sees specialist/value/photo and CTA before two scrolls, sees RU/EN/UA and can switch language without layout shift.
2. Client clicks «Записаться», selects service and a mock slot, fills name/contact, sees **DEMO** confirmation; demo entry appears in Owner CRM in same browser (localStorage).
3. Client clicks «Задать вопрос», AI **demo-script** answers on price/consultation in chosen language, offers booking route; never claims real AI or real provider connection.
4. Client chooses booking without AI; AI remains optional.
5. Owner sees new lead with source, preferred language, service, slot, status, and has access to conversation summary if such conversation existed in demo.
6. User refreshes local demo; booking persists; «Сбросить демоданные» clears data. No real client data required.

## P0 production booking tests
- Two concurrent POST booking attempts for same resource/start: only one confirmed.
- Retry same `idempotencyKey`: same appointment response, not duplicate.
- Cancelled/expired hold releases availability.
- DST in Europe/Dublin: last Sunday in March and October; nonexistent and ambiguous local times handled explicitly.
- Email provider failure results in `confirmationDeliveryStatus=failed`, not fake sent.
- Changing booking triggers correct rescheduling of reminders, not duplicate sends.
- Guest booking cannot retrieve/modify other users' bookings by guessing ID.
- No appointment status becomes `confirmed` before booking API commits successfully.

## P0 AI / KB tests
- Expert facts only from approved knowledge version, draft unpublished content ignored.
- Unknown price: politely says not confirmed; no made-up € amount.
- User asks «хочу записаться на пятницу»: returns actual availability, no long upsell.
- User asks about medical contraindications/rashes/pain: safe escalation, no diagnosis.
- Owner toggles knowledge version rollback: subsequent answers reflect correct version.
- If booking API errors, assistant says it could not confirm, not «вы записаны».
- RU/EN/UA tests: correct language switch and translations; channel-specific button copy.
- Ad comment when permission missing: no DM sent; proper log/error.
- LLM failure: non-AI booking works as expected.

## P1 growth tests
- Referral reward only after verified first completed visit, cannot self-refer.
- Waitlist offer expires and never double-books a cancelled slot; preference matching respects duration.
- Marketing unsubscribe stops reactivation but not legally necessary service notifications.
- Neutral review request sent without positive-review filtering/incentives.
- Source attribution retains original UTM when redirecting to service booking within same permitted session.
- Paid promotion cannot send unapproved messages simply for a like.

## Accessibility/performance
`axe` zero critical; keyboard navigation header/chat/booking; 44px touch target; color contrast WCAG AA; focus visible; screen reader labels; no autoplay audio; `prefers-reduced-motion`; Web Vitals budgets LCP 2.5s INP 200ms CLS 0.1. Verify iPhone 375/390/430 and desktop 1440.

## Security/privacy
Tenant A cannot access Tenant B appointments, photos, KB or clients. Consent purpose/time/source version tracked. API keys never in browser. Webhook wrong signature rejected. PII redacted in logs. DSAR export/delete workflow; photo consent separately. All write operations journaled. Rate limiting, abuse protection, injection attempts against AI and channel adapters tested.

## Evidence required
Provide screenshots per route at 375px and 1440px; 3 screen recordings or test traces of client path/AI/owner; passing test output, schema migrations and checklists; list of MOCK vs REAL actions; outstanding blockers with owner.
