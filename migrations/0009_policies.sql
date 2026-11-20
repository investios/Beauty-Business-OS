-- Этап 3 (ТЗ v2.0): правила бизнеса с версиями и условия, зафиксированные на момент записи.
-- Только добавляет таблицы; безопасно запускать повторно. Без неё сайт работает по значениям по умолчанию.
CREATE TABLE IF NOT EXISTS policies (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  PRIMARY KEY (tenant_id, key)
);
CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_policy_versions_key ON policy_versions(tenant_id, key, version);
-- Условия, действовавшие при создании записи: последующая смена правил их не меняет задним числом
CREATE TABLE IF NOT EXISTS appointment_terms (
  appointment_id TEXT PRIMARY KEY REFERENCES appointments(id),
  cancel_limit_hours INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
