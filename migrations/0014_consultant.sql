-- Роль консультанта: свои заметки, которых владелец не видит. Только добавляет таблицу; безопасно запускать повторно.
CREATE TABLE IF NOT EXISTS consultant_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consultant_notes ON consultant_notes(tenant_id, created_at);
