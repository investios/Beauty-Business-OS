-- 0016: Sales Lite (поток D). Аддитивно. Откат: DROP TABLE playbook_approval; DROP TABLE conversation_state; DROP TABLE message_decision;
-- Тексты сценариев лежат в src/data/playbooks.json (версионируются в git); в БД хранится только решение мастера и состояние беседы.
CREATE TABLE IF NOT EXISTS playbook_approval (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  family_id TEXT NOT NULL,
  catalog_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved','revoked')),
  approved_by TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, family_id)
);
CREATE TABLE IF NOT EXISTS conversation_state (
  conversation_id TEXT PRIMARY KEY REFERENCES conversations(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  stage TEXT NOT NULL DEFAULT 'lead_new',
  family_id TEXT,
  objection TEXT,
  suppressed_reason TEXT,
  next_action TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS message_decision (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  conversation_id TEXT,
  family_id TEXT NOT NULL,
  branch TEXT,
  allowed INTEGER NOT NULL,
  reason TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msgdec_tenant ON message_decision(tenant_id, at);
