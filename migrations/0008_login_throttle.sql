-- Защита входа в кабинет от подбора пароля: неудачные попытки хранятся в общей базе
-- (память сервера на Cloudflare не общая, поэтому подбор через разные копии сервера не считался).
-- Только добавляет таблицу; безопасно запускать повторно. Без неё вход работает как раньше (только лимит в памяти).
CREATE TABLE IF NOT EXISTS login_failures (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_failures_time ON login_failures(created_at);
CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures(ip, created_at);
