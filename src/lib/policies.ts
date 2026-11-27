import { auditStmt, nowIso, one, rows, uuid, type Db } from "@/lib/db";

/** Реестр правил бизнеса. Значения по умолчанию взяты из ТЗ v2.0; мастер меняет их в «Настройках». */
export type PolicyKey =
  | "cancel_limit_hours" | "remind_evening_before" | "remind_two_days" | "remind_two_days_min_ahead_days" | "remind_morning" | "remind_one_hour"
  | "followup_after_hours" | "rebook_after_days" | "master_busy" | "brief_hour"
  | "loyalty_visit_bonus_cents" | "referral_reward_cents" | "referral_friend_cents" | "vip_reserve_pct" | "vip_release_hours";
type Def = { label: string; hint: string; kind: "int" | "bool"; def: number; min?: number; max?: number; unit?: string };
export const POLICY_DEFS: Record<PolicyKey, Def> = {
  cancel_limit_hours: { label: "Отмена и перенос клиентом не позже, чем за", hint: "Ближе этого срока ИИ и ссылка не отменяют запись сами, а передают вопрос мастеру", kind: "int", def: 12, min: 0, max: 168, unit: "ч" },
  remind_evening_before: { label: "Напоминание вечером накануне визита", hint: "Уходит в 19:00 по Дублину за день до записи", kind: "bool", def: 1 },
  remind_two_days: { label: "Напоминание за 2 дня при ранней записи", hint: "Только если запись создана заранее (см. следующий пункт)", kind: "bool", def: 1 },
  remind_two_days_min_ahead_days: { label: "Считать запись ранней, если до неё не меньше", hint: "Тогда добавляется напоминание за 2 дня", kind: "int", def: 7, min: 3, max: 60, unit: "дн" },
  remind_morning: { label: "Напоминание утром в день визита", hint: "Выключено по умолчанию. Уходит в 09:00", kind: "bool", def: 0 },
  remind_one_hour: { label: "Напоминание за час до визита", hint: "Выключено по умолчанию", kind: "bool", def: 0 },
  followup_after_hours: { label: "Спросить, как прошла процедура, через", hint: "После того как мастер отметил визит состоявшимся", kind: "int", def: 24, min: 2, max: 168, unit: "ч" },
  master_busy: { label: "Режим «мастер занят»", hint: "ИИ предупреждает клиентов, что вы сейчас на процедуре и ответите позже. Запись и справочные ответы работают как обычно", kind: "bool", def: 0 },
  loyalty_visit_bonus_cents: { label: "ТЕСТ: бонус клиенту за состоявшийся визит", hint: "Тестовое значение для проверки механизма, размер решает мастер. 0 выключает начисления", kind: "int", def: 300, min: 0, max: 100000, unit: "центов" },
  referral_reward_cents: { label: "ТЕСТ: награда приглашающему за друга", hint: "Начисляется только после того, как друг пришёл на визит. Тестовое значение", kind: "int", def: 1000, min: 0, max: 100000, unit: "центов" },
  referral_friend_cents: { label: "ТЕСТ: приветственный бонус другу", hint: "Начисляется после его первого визита. Тестовое значение", kind: "int", def: 500, min: 0, max: 100000, unit: "центов" },
  vip_reserve_pct: { label: "Резерв времени для VIP, % свободных окон в день", hint: "0 выключает. Скрыто от обычной записи, видно только вам. Рекомендуется 10", kind: "int", def: 0, min: 0, max: 50, unit: "%" },
  vip_release_hours: { label: "Освобождать резерв за", hint: "Окна резерва снова становятся доступны всем за столько часов до визита", kind: "int", def: 48, min: 1, max: 168, unit: "ч" },
  brief_hour: { label: "Вечерняя сводка на завтра: во сколько собирать", hint: "Час по Дублину (15–23). Сводка собирается и лежит в «Обзоре». Наружу пока не отправляется", kind: "int", def: 19, min: 15, max: 23, unit: "ч" },
  rebook_after_days: { label: "Повторный визит по умолчанию, через", hint: "Для услуг, у которых срок не задан отдельно (ниже). Предложение уходит только клиентам с согласием", kind: "int", def: 28, min: 7, max: 365, unit: "дн" },
};
export const POLICY_KEYS = Object.keys(POLICY_DEFS) as PolicyKey[];
export type Policies = Record<PolicyKey, number>;
export const DEFAULT_POLICIES = Object.fromEntries(POLICY_KEYS.map((k) => [k, POLICY_DEFS[k].def])) as Policies;

/** Правила тенанта. Если таблицы ещё нет (миграция 0009 не применена), возвращает значения по умолчанию и persisted=false. */
export async function getPolicies(db: Db, tenantId: string): Promise<{ values: Policies; persisted: boolean }> {
  try {
    const rs = await rows<{ key: string; value: string }>(db, "SELECT key,value FROM policies WHERE tenant_id=?1", [tenantId]);
    const values = { ...DEFAULT_POLICIES };
    for (const r of rs) if (r.key in values) values[r.key as PolicyKey] = Number(r.value);
    return { values, persisted: true };
  } catch { return { values: { ...DEFAULT_POLICIES }, persisted: false }; }
}

export function validatePolicy(key: PolicyKey, raw: unknown): number | null {
  const d = POLICY_DEFS[key]; if (!d) return null;
  const n = typeof raw === "boolean" ? (raw ? 1 : 0) : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (d.kind === "bool") return n === 0 || n === 1 ? n : null;
  return n >= (d.min ?? 0) && n <= (d.max ?? 1e6) ? n : null;
}

/** Меняет правило: пишет новое значение, версию и журнал. Возвращает false, если значение не изменилось или недопустимо. */
export async function setPolicy(db: Db, tenantId: string, key: PolicyKey, raw: unknown, by: string): Promise<{ ok: boolean; reason?: string }> {
  const v = validatePolicy(key, raw);
  if (v === null) return { ok: false, reason: "invalid" };
  const cur = await one<{ value: string; version: number }>(db, "SELECT value,version FROM policies WHERE tenant_id=?1 AND key=?2", [tenantId, key]);
  const was = cur ? Number(cur.value) : POLICY_DEFS[key].def;
  if (was === v) return { ok: false, reason: "same" };
  const ver = (cur?.version ?? 0) + 1, at = nowIso();
  await db.batch([
    { sql: "INSERT INTO policies(tenant_id,key,value,version,updated_at,updated_by) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(tenant_id,key) DO UPDATE SET value=?3,version=?4,updated_at=?5,updated_by=?6", params: [tenantId, key, String(v), ver, at, by] },
    { sql: "INSERT INTO policy_versions(id,tenant_id,key,value,version,changed_by,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [uuid(), tenantId, key, String(v), ver, by, at] },
    auditStmt(tenantId, by, "policy.change", key, { from: was, to: v, version: ver }),
  ]);
  return { ok: true };
}

export async function policyHistory(db: Db, tenantId: string, limit = 30) {
  try { return await rows<{ key: string; value: string; version: number; changed_by: string; created_at: string }>(db, "SELECT key,value,version,changed_by,created_at FROM policy_versions WHERE tenant_id=?1 ORDER BY created_at DESC, version DESC LIMIT ?2", [tenantId, limit]); }
  catch { return []; }
}
