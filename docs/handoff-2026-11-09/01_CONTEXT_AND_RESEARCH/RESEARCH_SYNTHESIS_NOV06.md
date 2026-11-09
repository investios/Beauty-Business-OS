# СИНТЕЗ ИССЛЕДОВАНИЯ ОТ 6 НОЯБРЯ 2026

**Статус:** конспект исследовательских выводов ранее составленного 14-страничного документа от 6 ноября (18 разделов, 21 источник). **Это не побуквенная копия оригинала**. Отделяем цитируемые цифры исследований поставщиков от проектных гипотез.

## 1. Что покупает мастер
Не красивый сайт, не AI ради AI, а: (а) высвобождение часов административной работы, (б) меньше потерянных записей, (в) рост повторных визитов и выручки при контролируемой загрузке, (г) возможность добавить сотрудников. Удобство для мастера не менее важно, чем клиентский UX.

## 2. Поведение клиентов
Phorest Consumer Insights 2025 — выборка 716 пользователей салонов UK/IE: в опубликованном пересказе **61%** ориентируются на рекомендации при поиске салона, **45%** предпочитают цифровую запись, **50%** хотят персонализированных предложений/поощрений. Это результаты конкретной выборки, не весь мир. Клиент проверяет специалиста, реальные фото, отзывы, ожидаемые условия, локацию, цены и свободное время. Для первого визита особенно важно снизить неопределённость.

Zenoti публиковала бенчмарки отмен/неявок (~8% отмен и ~3% неявок в охваченной базе) и недоступных звонков; эти цифры vendor-derived и могут отличаться для Ирландии и конкретного пилота. Следовательно, нужны собственные baseline/метрики до заявления об экономическом эффекте.

## 3. Конкурентные платформы и что считать стандартом
- Phorest: онлайн-запись, retention, waitlist, уведомления, marketing, referrals, лояльность.
- Fresha: календарь, платежи, CRM, сегменты, маркетинг, marketplace.
- Booksy: booking links из Instagram, карточки клиентов, собственная экосистема.
- Treatwell/Salonized: различать собственный сайт/CRM и marketplace привлечения.
- Boulevard: AI receptionist и handoff, но дифференциация через более конкретное утверждённое экспертное знание мастера требует проверки.
- Zenoti: операционная метрика, недозвонившиеся клиенты, удержание.

Вывод: «у нас онлайн-запись» не уникальность. Отличие нужно измерять по обработанным обращениям без мастера, фактическому экономленному времени, конверсии и повторным визитам.

## 4. UX и психология
Не описывать «женщин» как единый психологический тип. Использовать проверяемые UX-принципы: premium визуал, реальные результаты, доверие, человек за работой, понятные условия, свободные слоты. Mobile-first, минимальное число полей, отсутствие обязательного скачивания приложения, visible CTA. При необходимости 3 дизайн-направления: Editorial Premium, Warm Personal Expert, Clean Professional. Одна конверсионная архитектура, разные визуальные системы.

## 5. Маркетинговые механики — широкий каталог, но четыре по умолчанию
Исследование рассмотрело 12 идей: следующая запись; двусторонняя рекомендация; waitlist для отмен; возвращение клиентов; партнёрские ссылки; клубные привилегии; нейтральный запрос честного отзыва; photo/UGC с разрешением; предложения на непиковые часы; подарочные сертификаты; пакеты/абонементы; релевантные доп. услуги. Первыми включаем автоматические **rebook, referral, waitlist, reactivation**. Остальное — на переключателях/в следующем этапе, если подтверждён результат.

## 6. Партизанский и вирусный маркетинг
Тестовые идеи, не гарантии: share-link после визита, mini-guide по уходу, QR у зеркала для повторной записи, партнёрские QR у кафе/фитнеса/визажистов, тематические события, материалы для «до/после» с согласием, полезный FAQ-контент из реальных обращений, beauty passport у местных партнёров. Каждый канал измерять от касания до подтверждённого визита. Никаких фиктивных дефицитов, отзывов или обещаний.

## 7. «Умный маркетинг» зависит от загрузки
Пустой календарь → reactivation, partner/referral, целевая реклама. Средний → повысить booking conversion, оптимизировать длительность и буферы. Полный → удержание, ценность часа, защита от отмен, подготовка найма. Нельзя обещать всем доступность, когда слотов нет.

## 8. AI как эксперт первой линии
Мастер формирует утверждённые knowledge cards: услуга, варианты, подготовка, длительность, цены/диапазоны, уход, ограничения. AI сначала отвечает на вопрос, уточняет контекст, предлагает реальный слот, передаёт сложное мастеру с резюме. Версии знаний, тестовые диалоги, human approval, rollback, ошибки и handoff. Операционные действия возможны только через верифицированные API.

## 9. Instagram и рекламная воронка
Instagram — первый продающий экран для активного мастера. Не заставлять переходить на сайт при желании записаться в DM; на сайте одновременно прямая запись и добровольная консультация. Рекламные front-offers: краткая консультация, мини-гид, подбор услуги. Отправка private reply на комментарии и Direct — строго в рамках актуальных правил Meta, конкретных permissions и аккаунта. Лайк не означает разрешения писать в личку.

## 10. Кабинет мастера
Today/Week: календарь, отмеченные исключения, новые/постоянные, подтверждённая выручка, свободные окна; AI: вопросы для утверждения; Marketing: четыре механики и их результат; Growth: сигналы необходимости роста/сотрудника. Разработчику не создавать 70-переключательный cockpit.

## 11. Метрики для пилота
Время на администрирование до/после, qualified leads → confirmed visits, booking completion, AI resolution quality, handoff, no-show, возвращённые отменённые слоты, retention, referral completed first visits, utilisation, revenue per available hour. Любая «экономия времени» — только по измерениям мастера, а не по обещанию модели.

## 12. План 30/60/90
**0–30:** интервью 6–10 мастеров (по возможности), пилот одной вертикали, базовые услуги, подтверждённые FAQ, сайт, сценарная/реальная запись, измерение времени.
**31–60:** календарь, переносы, напоминания, waitlist, AI quality, тест реальных обращений и handoff.
**61–90:** рефералы, локальные партнёры, лояльность, аналитика, управление командой, решение о расширении.

## 13. Ограничения эксплуатации
AI идентифицирует себя, маркетинговые согласия и сервисные сообщения отделены; WhatsApp templates/конверсационные ограничения, контроль файлов и фото, GDPR, DPA, запрет стимулированных Google reviews, audit действий. Отдельные денежные споры и индивидуальная клиническая оценка — человек.

## Основные первичные источники, перечисленные в прежнем исследовании
[S1] Phorest 2025: https://www.phorest.com/gb/resources/salon-consumer-insights-report-2025/
[S2] Irish Beauty 2025: https://irishbeauty.ie/Phorest-Consumer-Insights-Report-2025.html
[S3] Zenoti 2025: https://www.zenoti.com/thecheckin/beauty-wellness-industry-statistics-2025
[S4] Zenoti 2026: https://www.zenoti.com/thecheckin/the-revenue-decision-before-the-appointment-book
[S5] Phorest features: https://www.phorest.com/features/
[S6] Fresha features: https://www.fresha.com/for-business/features
[S7] Booksy IG button: https://support.booksy.com/hc/en-ie/articles/16486489939602-How-do-I-take-bookings-from-Instagram
[S8] Treatwell business: https://www.treatwell.co.uk/partners/resources/blog/best-salon-software/
[S9] Boulevard AI receptionist FAQ: https://support.boulevard.io/en/articles/16105159-ai-receptionist-frequently-asked-questions
[S10] Baymard checkout UX: https://baymard.com/blog/current-state-of-checkout-ux
[S11] Google Web Vitals: https://developers.google.com/search/docs/appearance/core-web-vitals
[S12] Google Maps review policy: https://support.google.com/contributionpolicy/answer/7400114
[S13] Google Business booking links: https://support.google.com/business/answer/6218037
[S14] EU AI Act transparency: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
[S15] Irish DPC direct marketing: https://www.dataprotection.ie/en/organisations/rules-electronic-and-direct-marketing
[S16] WhatsApp policy: https://whatsappbusiness.com/policy/
[S17] Irish DPC photographs: https://www.dataprotection.ie/en/faqs/topical-data-protection-issues/what-position-regarding-individuals-taking-photographsvideos-public-place
[S18] EC data processing legal grounds: https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en
[S19] EC GDPR controller/processor: https://commission.europa.eu/en/law/law-topic/data-protection/information-business-and-organisations/application-gdpr_en
[S20] Townhouse membership: https://townhousebeauty.com/pages/membership
[S21] Heyday membership: https://www.heydayskincare.com/pages/membership.html

Ссылки — список из ранее созданного исследования, **не повторно проверенные на дату упаковки**; перед production-интеграциями перепроверить актуальность и условия.
