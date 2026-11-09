-- Единая схема для Cloudflare D1 и локального SQLite (тесты, разработка).
-- Время хранится как текст ISO-8601 в UTC (всегда формат toISOString), JSON как текст, булевы как 0/1.
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Dublin',
  default_locale TEXT NOT NULL DEFAULT 'en',
  brand_theme TEXT NOT NULL DEFAULT 'editorial-luxe',
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  slug TEXT NOT NULL,
  title_i18n TEXT NOT NULL,
  desc_i18n TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min > 0),
  buffer_min INTEGER NOT NULL DEFAULT 0 CHECK (buffer_min >= 0),
  price_mode TEXT NOT NULL DEFAULT 'unconfirmed' CHECK (price_mode IN ('unconfirmed','from','fixed','range')),
  price_from_cents INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  is_placeholder INTEGER NOT NULL DEFAULT 1,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE staff_services (
  staff_id TEXT NOT NULL REFERENCES staff(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  PRIMARY KEY (staff_id, service_id)
);

-- Рабочие часы по МЕСТНОМУ времени салона (минуты от полуночи)
CREATE TABLE availability_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL CHECK (end_min > start_min)
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  contact_norm TEXT NOT NULL,
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  created_from TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, contact_norm)
);

CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('service','marketing')),
  channel TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  withdrawn_at TEXT
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT REFERENCES clients(id), -- NULL только у временного удержания (held)
  staff_id TEXT NOT NULL REFERENCES staff(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  blocked_until TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','held','confirmed','completed','cancelled','no_show')),
  hold_expires_at TEXT,
  idempotency_key TEXT NOT NULL,
  manage_token TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT '{}',
  confirmation_delivery_status TEXT NOT NULL DEFAULT 'not_configured',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX appointments_tenant_start ON appointments (tenant_id, start_at);
CREATE INDEX appointments_staff_start ON appointments (staff_id, start_at);

-- Защита от двойной записи на уровне БД (замена exclusion constraint из PostgreSQL):
-- один мастер не может иметь пересекающиеся активные записи. Ошибка 'slot_overlap' откатывает всю операцию.
CREATE TRIGGER appt_no_overlap_ins BEFORE INSERT ON appointments
WHEN NEW.status IN ('held','confirmed','requested')
BEGIN
  SELECT RAISE(ABORT, 'slot_overlap') WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.staff_id = NEW.staff_id AND a.id <> NEW.id
      AND a.status IN ('held','confirmed','requested')
      AND a.start_at < NEW.blocked_until AND a.blocked_until > NEW.start_at);
END;

CREATE TRIGGER appt_no_overlap_upd BEFORE UPDATE ON appointments
WHEN NEW.status IN ('held','confirmed','requested')
BEGIN
  SELECT RAISE(ABORT, 'slot_overlap') WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.staff_id = NEW.staff_id AND a.id <> NEW.id
      AND a.status IN ('held','confirmed','requested')
      AND a.start_at < NEW.blocked_until AND a.blocked_until > NEW.start_at);
END;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  appointment_id TEXT REFERENCES appointments(id),
  kind TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','not_configured','cancelled')),
  scheduled_for TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT REFERENCES clients(id),
  channel TEXT NOT NULL DEFAULT 'website',
  locale TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  knowledge_version INTEGER,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE handoffs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  reason TEXT NOT NULL,
  summary TEXT NOT NULL,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at TEXT NOT NULL
);

CREATE TABLE knowledge_articles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL,
  topic TEXT NOT NULL,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  answer TEXT NOT NULL,
  draft_answer TEXT,
  forbidden TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  approved_by TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, key, locale)
);

CREATE TABLE knowledge_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, version)
);

CREATE TABLE automations (
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  key TEXT NOT NULL CHECK (key IN ('rebook','referral','waitlist','reactivation')),
  enabled INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  diff TEXT,
  at TEXT NOT NULL
);
