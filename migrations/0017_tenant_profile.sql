-- Профиль мастера: имя, студия, тон. Хранится по салону; тексты ИИ и сценариев берут имя отсюда.
CREATE TABLE IF NOT EXISTS tenant_profile (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
  master_name TEXT NOT NULL DEFAULT '',
  master_name_latin TEXT NOT NULL DEFAULT '',
  studio_name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address_form TEXT NOT NULL DEFAULT 'vy',
  tone TEXT NOT NULL DEFAULT 'warm',
  forms TEXT NOT NULL DEFAULT '{}',
  about TEXT NOT NULL DEFAULT '',
  reference_pack TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
-- Уже существующим салонам (сейчас это студия Милы) ставим её значения. Повторный запуск безопасен.
INSERT OR IGNORE INTO tenant_profile(tenant_id,master_name,master_name_latin,studio_name,city,reference_pack,updated_at)
SELECT id,'Мила','Mila','MK Extension Studio by Mila','Дублин','mk-extension-studio',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM tenants;
