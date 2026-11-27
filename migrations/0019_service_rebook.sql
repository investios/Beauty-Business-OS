-- Срок повторного визита по каждой услуге (дни). Нет строки: берётся общее правило rebook_after_days.
CREATE TABLE IF NOT EXISTS service_rebook (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  days INTEGER NOT NULL CHECK (days BETWEEN 7 AND 365),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, service_id)
);
