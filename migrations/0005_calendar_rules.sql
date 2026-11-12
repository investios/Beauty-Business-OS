-- PR2: правила по услугам и лист ожидания. Только добавляет таблицы; безопасно запускать повторно.
-- Перед применением сделайте резервную копию базы (Cloudflare → D1 → beauty-os → Time Travel/Export).

-- Ограничения для каждой услуги. Нет строки = услуга без ограничений.
-- weekdays: дни недели через запятую, 0=воскресенье … 6=суббота
-- earliest_min / latest_min: окно, внутри которого может НАЧИНАТЬСЯ запись (минуты от полуночи)
-- max_per_day: сколько записей этой услуги можно принять за один день
-- buffer_before_min: свободное время ДО записи (подготовка)
CREATE TABLE IF NOT EXISTS service_rules (
  service_id TEXT PRIMARY KEY REFERENCES services(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  weekdays TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  earliest_min INTEGER CHECK (earliest_min IS NULL OR (earliest_min >= 0 AND earliest_min < 1440)),
  latest_min INTEGER CHECK (latest_min IS NULL OR (latest_min >= 0 AND latest_min <= 1440)),
  max_per_day INTEGER CHECK (max_per_day IS NULL OR max_per_day >= 1),
  buffer_before_min INTEGER NOT NULL DEFAULT 0 CHECK (buffer_before_min >= 0 AND buffer_before_min <= 240),
  updated_at TEXT NOT NULL,
  CHECK (earliest_min IS NULL OR latest_min IS NULL OR latest_min > earliest_min)
);

-- Лист ожидания: клиент хочет попасть, когда освободится время. Сообщения клиентам пока не отправляются.
CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  client_name TEXT NOT NULL,
  contact TEXT NOT NULL,
  day_from TEXT NOT NULL,
  day_to TEXT NOT NULL,
  note TEXT,
  consent_contact INTEGER NOT NULL DEFAULT 0 CHECK (consent_contact IN (0,1)),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','booked','removed')),
  created_at TEXT NOT NULL,
  CHECK (day_to >= day_from)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status ON waitlist(tenant_id, status, day_from);
