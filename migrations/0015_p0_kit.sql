-- 0015: P0 комплекта v3.1. Только аддитивные CREATE ... IF NOT EXISTS.
-- Откат: DROP TABLE master_state; DROP TABLE suppressions; DROP TABLE message_events; (код без таблиц работает: ошибки перехватываются)
CREATE TABLE IF NOT EXISTS master_state (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  state TEXT NOT NULL DEFAULT 'available' CHECK (state IN ('available','in_procedure','break','off','dnd')),
  until_at TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'owner'
);
CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  contact_norm TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'marketing' CHECK (scope IN ('marketing','all')),
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','owner')),
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, contact_norm, scope)
);
CREATE TABLE IF NOT EXISTS message_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  notification_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','delivered','failed','suppressed')),
  provider_event TEXT,
  at TEXT NOT NULL,
  UNIQUE (notification_id, status)
);
CREATE INDEX IF NOT EXISTS idx_msgev_notif ON message_events(notification_id);
