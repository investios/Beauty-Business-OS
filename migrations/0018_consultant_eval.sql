-- Проверка консультанта на живых вопросах: ответы модели и пометки. Запускает владелец платформы.
CREATE TABLE IF NOT EXISTS consultant_eval (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  run_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  question TEXT NOT NULL,
  route TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  flags TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consultant_eval ON consultant_eval(tenant_id, run_id, created_at);
