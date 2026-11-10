-- Расписание мастера: настройки слотов и исключения по датам (выходные, дополнительные дни).
-- Только добавляет таблицы; безопасно запускать повторно.
CREATE TABLE IF NOT EXISTS schedule_settings (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  step_min INTEGER NOT NULL DEFAULT 60 CHECK (step_min BETWEEN 5 AND 240),
  min_notice_min INTEGER NOT NULL DEFAULT 0 CHECK (min_notice_min >= 0),
  horizon_days INTEGER NOT NULL DEFAULT 183 CHECK (horizon_days BETWEEN 1 AND 366)
);

-- day: местная дата YYYY-MM-DD; closed без времени = весь день выходной, closed со временем = закрытый промежуток,
-- open = дополнительные рабочие часы в эту дату (например, воскресенье)
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('closed','open')),
  start_min INTEGER,
  end_min INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  CHECK ((start_min IS NULL AND end_min IS NULL AND kind = 'closed') OR (start_min IS NOT NULL AND end_min IS NOT NULL AND end_min > start_min))
);
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_day ON schedule_exceptions(tenant_id, day);
