# Выкладка на Cloudflare (Workers + D1)

Сайт работает в среде Cloudflare Workers, база данных: Cloudflare D1 (SQLite). Локально проверено: сборка через OpenNext, эмулятор D1, полный клик-тест и вёрстка.

## Что нужно один раз
1. Аккаунт Cloudflare и API-токен с правами **Workers Scripts: Edit** и **D1: Edit** (My Profile → API Tokens).
2. Токен передаётся только как переменная окружения `CLOUDFLARE_API_TOKEN` (и `CLOUDFLARE_ACCOUNT_ID`). В репозиторий и в код его класть нельзя.

## Команды (по порядку)
```bash
npm ci
npx wrangler d1 create beauty-os                 # выдаст database_id → вписать в wrangler.jsonc
npm run db:remote                                # применить migrations/0001_init.sql к боевой D1
npx wrangler secret put OWNER_PASSWORD           # пароль кабинета мастера
npx wrangler secret put SESSION_SECRET           # длинная случайная строка (16+ символов)
npm test && npm run cf:build
npm run cf:deploy                                # выкладка Worker
```
Начальные данные (демо-салон, база знаний) создаются автоматически при первом запросе. Домен подключается в Cloudflare → Workers → Settings → Domains.

## Локальная проверка «как в облаке»
```bash
cp .dev.vars.example .dev.vars        # свои значения
npm run db:local                      # миграции в эмулятор D1
npm run cf:preview                    # http://localhost:8787
```

## Важные отличия D1 от прежней PostgreSQL
- Многошаговых транзакций нет, поэтому записи выполняются пачками (`batch`): пачка применяется целиком или не применяется вовсе.
- Защита от двойной записи: триггер в самой базе (`slot_overlap`) отклоняет пересекающиеся записи одного мастера; проверено тестами и гонкой из 6 одновременных запросов (создаётся ровно одна).
- Ограничение частоты запросов хранится в памяти экземпляра Worker. Для боя лучше правила Cloudflare (Rate Limiting) на `/api/v1/*` и `/api/v1/owner/login`.
- Бесплатные лимиты D1/Workers достаточны для пилота; перед ростом проверить актуальные тарифы.

## Статус выкладки (9 ноября 2026)
- Сайт: https://beauty-business-os.investios.workers.dev (Worker `beauty-business-os`)
- База: D1 `beauty-os`, регион EU (EEUR), миграция 0001 применена
- Секреты `OWNER_PASSWORD` и `SESSION_SECRET` заданы в Cloudflare, в репозитории их нет
- Проверено на боевом адресе: страницы EN/RU/UA, вход в кабинет (неверный пароль даёт 401), вёрстка 48 сочетаний страница×ширина
