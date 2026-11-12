-- PR3: сообщения клиентам (пробный режим). Только добавляет таблицу и индекс; безопасно запускать повторно.
-- Тексты писем хранятся здесь как «что было бы отправлено». Ссылки управления записью в текст не сохраняются.
CREATE TABLE IF NOT EXISTS lifecycle_messages (
  notification_id TEXT PRIMARY KEY REFERENCES notifications(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  locale TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('simulated','sent','failed','skipped')),
  skip_reason TEXT,
  processed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_tenant_time ON lifecycle_messages(tenant_id, processed_at);
-- Одна активная задача «как прошёл визит» и «повторный визит» на запись (защита от дублей)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_lifecycle ON notifications(appointment_id, kind)
  WHERE kind IN ('followup','rebook') AND status <> 'cancelled';
