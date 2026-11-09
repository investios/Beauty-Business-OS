export const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Dublin',
  default_locale text NOT NULL DEFAULT 'en',
  brand_theme text NOT NULL DEFAULT 'editorial-luxe',
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  slug text NOT NULL,
  title_i18n jsonb NOT NULL,
  desc_i18n jsonb NOT NULL,
  duration_min int NOT NULL CHECK (duration_min > 0),
  buffer_min int NOT NULL DEFAULT 0 CHECK (buffer_min >= 0),
  price_mode text NOT NULL DEFAULT 'unconfirmed' CHECK (price_mode IN ('unconfirmed','from','fixed','range')),
  price_from_cents int,
  active boolean NOT NULL DEFAULT true,
  is_placeholder boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS staff_services (
  staff_id uuid NOT NULL REFERENCES staff(id),
  service_id uuid NOT NULL REFERENCES services(id),
  PRIMARY KEY (staff_id, service_id)
);

-- Рабочие часы по МЕСТНОМУ времени салона (минуты от полуночи), а не по UTC
CREATE TABLE IF NOT EXISTS availability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  staff_id uuid NOT NULL REFERENCES staff(id),
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min int NOT NULL,
  end_min int NOT NULL CHECK (end_min > start_min)
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  contact text NOT NULL,
  contact_norm text NOT NULL,
  preferred_locale text NOT NULL DEFAULT 'en',
  created_from jsonb NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, contact_norm)
);

CREATE TABLE IF NOT EXISTS consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  purpose text NOT NULL CHECK (purpose IN ('service','marketing')),
  channel text NOT NULL,
  policy_version text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);

CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id), -- NULL только у временного удержания (held)
  staff_id uuid NOT NULL REFERENCES staff(id),
  service_id uuid NOT NULL REFERENCES services(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  blocked_until timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','held','confirmed','completed','cancelled','no_show')),
  hold_expires_at timestamptz,
  idempotency_key text NOT NULL,
  manage_token text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  source jsonb NOT NULL DEFAULT '{}',
  confirmation_delivery_status text NOT NULL DEFAULT 'not_configured',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key),
  -- Защита от двойной записи на уровне БД: один мастер не может иметь пересекающиеся активные записи
  CONSTRAINT no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_at, blocked_until) WITH &&
  ) WHERE (status IN ('held','confirmed','requested'))
);
CREATE INDEX IF NOT EXISTS appointments_tenant_start ON appointments (tenant_id, start_at);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  appointment_id uuid REFERENCES appointments(id),
  kind text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','not_configured','cancelled')),
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  channel text NOT NULL DEFAULT 'website',
  locale text NOT NULL DEFAULT 'en',
  source jsonb NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  knowledge_version int,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  reason text NOT NULL,
  summary text NOT NULL,
  contact text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key text NOT NULL,
  topic text NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  answer text NOT NULL,
  draft_answer text,
  forbidden jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  approved_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key, locale)
);

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  approved_by text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

CREATE TABLE IF NOT EXISTS automations (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key text NOT NULL CHECK (key IN ('rebook','referral','waitlist','reactivation')),
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  actor text NOT NULL,
  action text NOT NULL,
  target text,
  diff jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
`;
