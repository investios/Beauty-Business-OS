-- Этап 5 (ТЗ v2.0): бонусный журнал, рефералы, VIP. Деньги и бонусы только целыми числами в центах.
-- Только добавляет таблицы; безопасно запускать повторно.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  kind TEXT NOT NULL CHECK (kind IN ('accrual','referral_reward','referral_welcome','redemption','adjustment')),
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  idem_key TEXT,
  is_test INTEGER NOT NULL DEFAULT 1 CHECK (is_test IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idem ON loyalty_ledger(tenant_id, idem_key) WHERE idem_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_client ON loyalty_ledger(tenant_id, client_id, created_at);
CREATE TABLE IF NOT EXISTS referral_codes (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  referrer_client_id TEXT NOT NULL REFERENCES clients(id),
  friend_client_id TEXT NOT NULL UNIQUE REFERENCES clients(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','rewarded','rejected')),
  created_at TEXT NOT NULL,
  rewarded_at TEXT
);
CREATE TABLE IF NOT EXISTS vip_status (
  client_id TEXT PRIMARY KEY REFERENCES clients(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  reason TEXT NOT NULL DEFAULT '',
  granted_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vip_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  master_note TEXT,
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vip_requests ON vip_requests(tenant_id, status, created_at);
