-- Этап 5 (ТЗ v2.0): очередь фоновых задач с ключом идемпотентности и вечерняя сводка мастера.
-- Только добавляет таблицы; безопасно запускать повторно.
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  kind TEXT NOT NULL,
  run_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  run_after TEXT NOT NULL,
  last_error TEXT,
  result TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_after);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id, created_at);
CREATE TABLE IF NOT EXISTS daily_briefs (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  day TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, day)
);
