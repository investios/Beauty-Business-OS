# Beauty Business OS: сайт мастера + система записи и продаж

Рабочий прототип по ТЗ из `Beauty_Business_OS_Handoff_2026-11-09`. Публичный сайт EN/RU/UA, запись без регистрации, ИИ-консультант (пока сценарный), кабинет мастера, учёт источников.

**Прочитайте `docs/MOCK_VS_REAL.md`**: там честно сказано, что работает, а что заглушка.

## Запуск
```bash
npm install
cp .env.example .env.local   # задайте OWNER_PASSWORD и SESSION_SECRET
npm run build && npm start   # http://localhost:3000
```
Без `.env.local` в режиме разработки (`npm run dev`) пароль кабинета `demo-owner`; в production пароль и ключ обязательны.
- Сайт: `/en`, `/ru`, `/uk` · Запись: `/ru/book` · Кабинет: `/owner`

## Проверки
```bash
npm test          # 40 автотестов: запись, гонки, идемпотентность, DST, тенанты, ИИ, сессии
npm run typecheck
# браузерные (нужны playwright и axe-core, сервер запущен):
node tests/e2e/layout.cjs    # 8 ширин × 6 страниц: переполнение, касания 44px, доступность
node tests/e2e/journey.cjs   # путь клиента, чат, кабинет
```

## Структура
`src/lib/booking.ts` движок записи · `src/lib/ai.ts` диалог и база знаний · `src/lib/schema.ts` схема БД · `src/app/api/v1/…` API · `src/app/[locale]` сайт · `src/app/owner` кабинет · `docs/` решения и вопросы.
