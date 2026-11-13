-- PR4: действия ИИ-администратора (перенос и отмена записи) с явным подтверждением клиентом.
-- Только добавляет таблицу; безопасно запускать повторно. ИИ сам ничего не меняет: действие выполняется
-- только после нажатия клиентом кнопки «Подтверждаю», один раз и в течение 15 минут.
CREATE TABLE IF NOT EXISTS ai_pending_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  kind TEXT NOT NULL CHECK (kind IN ('lookup','cancel','reschedule')),
  booking_id TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT '',
  new_start_utc TEXT,
  status TEXT NOT NULL CHECK (status IN ('awaiting_choice','awaiting_slot','pending','done','declined','expired','failed')),
  error TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  done_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_actions_conv ON ai_pending_actions(conversation_id, status);
