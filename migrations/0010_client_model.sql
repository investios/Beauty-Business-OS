-- Этап 3B (ТЗ v2.0): статусы клиентов с историей, заметки по категориям, жалобы, отзывы, предпочитаемый канал.
-- Только добавляет таблицы; безопасно запускать повторно.
CREATE TABLE IF NOT EXISTS client_state (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','overdue','at_risk','lost','inactive','archived')),
  manual INTEGER NOT NULL DEFAULT 0,
  preferred_channel TEXT NOT NULL DEFAULT 'email' CHECK (preferred_channel IN ('email','phone','whatsapp','instagram','messenger')),
  status_updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS client_status_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_hist_client ON client_status_history(tenant_id, client_id, created_at);
CREATE TABLE IF NOT EXISTS client_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  category TEXT NOT NULL CHECK (category IN ('preference','technical','health','payment','communication','other')),
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_client ON client_notes(tenant_id, client_id, created_at);
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  appointment_id TEXT REFERENCES appointments(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant ON complaints(tenant_id, status, created_at);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  appointment_id TEXT REFERENCES appointments(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON reviews(tenant_id, created_at);
