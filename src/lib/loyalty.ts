import { auditStmt, nowIso, one, rows, uuid, type Db } from "./db";
import { getPolicies } from "./policies";

/** Лояльность. Правила: деньги и бонусы только целые центы; баланс = сумма журнала; начисления идемпотентны (ключ);
 *  списание, корректировка, VIP и решения о компенсации принимает только мастер; награда за друга только после его реального визита.
 *  Размеры бонусов сейчас тестовые (помечены is_test) и задаются в «Настройках». */
const isCents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };

export async function balance(db: Db, tenantId: string, clientId: string): Promise<number> {
  return safe(async () => (await rows<{ b: number | null }>(db, "SELECT COALESCE(SUM(amount_cents),0) b FROM loyalty_ledger WHERE tenant_id=?1 AND client_id=?2", [tenantId, clientId]))[0].b ?? 0, 0);
}
export const ledger = (db: Db, tenantId: string, clientId: string) =>
  safe(() => rows<{ id: string; kind: string; amount_cents: number; reason: string; is_test: number; created_at: string }>(db, "SELECT id,kind,amount_cents,reason,is_test,created_at FROM loyalty_ledger WHERE tenant_id=?1 AND client_id=?2 ORDER BY created_at DESC, rowid DESC LIMIT 30", [tenantId, clientId]), [] as { id: string; kind: string; amount_cents: number; reason: string; is_test: number; created_at: string }[]);

/** Записывает строку журнала. Повтор с тем же ключом ничего не меняет (возвращает false). */
async function post(db: Db, tenantId: string, clientId: string, kind: string, cents: number, reason: string, by: string, idem: string | null): Promise<boolean> {
  if (!isCents(cents) || cents === 0) return false;
  try {
    const r = await db.batch([
      { sql: "INSERT OR IGNORE INTO loyalty_ledger(id,tenant_id,client_id,kind,amount_cents,reason,idem_key,is_test,created_by,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,1,?8,?9 WHERE EXISTS (SELECT 1 FROM clients WHERE id=?3 AND tenant_id=?2)", params: [uuid(), tenantId, clientId, kind, cents, reason.slice(0, 200), idem, by, nowIso()] },
    ]);
    if (r[0].changes === 1) { const a = auditStmt(tenantId, by, `loyalty.${kind}`, clientId, { cents }); await db.run(a.sql, a.params); return true; }
    return false;
  } catch { return false; }
}

/** Списание бонусов решает мастер; больше баланса списать нельзя. */
export async function redeem(db: Db, tenantId: string, clientId: string, cents: number, reason = "", by = "owner"): Promise<"ok" | "invalid" | "insufficient"> {
  if (!isCents(cents) || cents <= 0) return "invalid";
  if ((await balance(db, tenantId, clientId)) < cents) return "insufficient";
  return (await post(db, tenantId, clientId, "redemption", -cents, reason || "списание", by, null)) ? "ok" : "invalid";
}
export async function adjust(db: Db, tenantId: string, clientId: string, cents: number, reason: string, by = "owner"): Promise<"ok" | "invalid" | "insufficient"> {
  if (!isCents(cents) || cents === 0 || !reason.trim()) return "invalid";
  if (cents < 0 && (await balance(db, tenantId, clientId)) < -cents) return "insufficient";
  return (await post(db, tenantId, clientId, "adjustment", cents, reason, by, null)) ? "ok" : "invalid";
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export async function referralCode(db: Db, tenantId: string, clientId: string): Promise<string | null> {
  try {
    const cur = await one<{ code: string }>(db, "SELECT code FROM referral_codes WHERE client_id=?1 AND tenant_id=?2", [clientId, tenantId]);
    if (cur) return cur.code;
    if (!(await one(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]))) return null;
    for (let i = 0; i < 5; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code = Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
      const r = await db.run("INSERT OR IGNORE INTO referral_codes(client_id,tenant_id,code) VALUES (?1,?2,?3)", [clientId, tenantId, code]);
      if (r.changes === 1) return code;
    }
    return null;
  } catch { return null; }
}

/** Фоновая задача: связывает новых клиентов с пригласившими, начисляет бонусы за состоявшиеся визиты и награды за друзей. Повтор ничего не дублирует. */
export async function runLoyalty(db: Db, tenantId: string, nowMs = Date.now()): Promise<{ linked: number; accrued: number; rewarded: number; ready: boolean }> {
  const out = { linked: 0, accrued: 0, rewarded: 0, ready: true };
  try { await rows(db, "SELECT 1 FROM loyalty_ledger LIMIT 1"); } catch { return { ...out, ready: false }; }
  const pol = (await getPolicies(db, tenantId)).values;
  // 1. Новые клиенты, пришедшие по коду приглашения (ref в источнике записи)
  const cand = await rows<{ client_id: string; ref: string }>(db,
    `SELECT a.client_id, json_extract(a.source,'$.ref') ref FROM appointments a
     WHERE a.tenant_id=?1 AND a.client_id IS NOT NULL AND json_extract(a.source,'$.ref') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM referrals r WHERE r.friend_client_id=a.client_id)
       AND NOT EXISTS (SELECT 1 FROM appointments e WHERE e.client_id=a.client_id AND e.status='completed')
     GROUP BY a.client_id`, [tenantId]);
  for (const c of cand) {
    const rc = await one<{ client_id: string }>(db, "SELECT client_id FROM referral_codes WHERE tenant_id=?1 AND code=?2", [tenantId, String(c.ref).toUpperCase()]);
    if (!rc || rc.client_id === c.client_id) continue; // неизвестный код или приглашение самого себя
    const same = await one(db, "SELECT 1 x FROM clients a JOIN clients b ON a.contact_norm=b.contact_norm WHERE a.id=?1 AND b.id=?2", [c.client_id, rc.client_id]);
    if (same) continue;
    const r = await db.run("INSERT OR IGNORE INTO referrals(id,tenant_id,referrer_client_id,friend_client_id,created_at) VALUES (?1,?2,?3,?4,?5)", [uuid(), tenantId, rc.client_id, c.client_id, nowIso()]);
    out.linked += r.changes;
  }
  // 2. Бонус за состоявшийся визит (идемпотентно по записи)
  if (pol.loyalty_visit_bonus_cents > 0) {
    const done = await rows<{ id: string; client_id: string }>(db, "SELECT id,client_id FROM appointments WHERE tenant_id=?1 AND status='completed' AND client_id IS NOT NULL AND start_at>=?2", [tenantId, new Date(nowMs - 120 * 86400000).toISOString()]);
    for (const a of done) if (await post(db, tenantId, a.client_id, "accrual", pol.loyalty_visit_bonus_cents, "бонус за визит (тестовый размер)", "system", `visit:${a.id}`)) out.accrued++;
  }
  // 3. Награда за друга: только когда друг реально пришёл на визит
  const pend = await rows<{ id: string; referrer_client_id: string; friend_client_id: string }>(db, "SELECT id,referrer_client_id,friend_client_id FROM referrals WHERE tenant_id=?1 AND status='pending'", [tenantId]);
  for (const r of pend) {
    if (!(await one(db, "SELECT 1 x FROM appointments WHERE client_id=?1 AND tenant_id=?2 AND status='completed' LIMIT 1", [r.friend_client_id, tenantId]))) continue;
    await post(db, tenantId, r.referrer_client_id, "referral_reward", pol.referral_reward_cents, "награда за приглашённого друга (тестовый размер)", "system", `ref:${r.id}`);
    await post(db, tenantId, r.friend_client_id, "referral_welcome", pol.referral_friend_cents, "приветственный бонус (тестовый размер)", "system", `refwelcome:${r.id}`);
    await db.run("UPDATE referrals SET status='rewarded', rewarded_at=?2 WHERE id=?1 AND status='pending'", [r.id, nowIso()]);
    out.rewarded++;
  }
  return out;
}

/* ---------- VIP: статус и срочная запись решает мастер ---------- */
export const isVip = (db: Db, tenantId: string, clientId: string) => safe(async () => !!(await one(db, "SELECT 1 x FROM vip_status WHERE client_id=?1 AND tenant_id=?2", [clientId, tenantId])), false);
export async function setVip(db: Db, tenantId: string, clientId: string, on: boolean, reason: string, by = "owner"): Promise<boolean> {
  try {
    if (!(await one(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]))) return false;
    if (on) await db.run("INSERT INTO vip_status(client_id,tenant_id,reason,granted_by,created_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(client_id) DO UPDATE SET reason=?3", [clientId, tenantId, reason.slice(0, 200), by, nowIso()]);
    else await db.run("DELETE FROM vip_status WHERE client_id=?1 AND tenant_id=?2", [clientId, tenantId]);
    const a = auditStmt(tenantId, by, on ? "vip.grant" : "vip.revoke", clientId); await db.run(a.sql, a.params);
    return true;
  } catch { return false; }
}
/** Запрос срочной записи от VIP-клиента: только план для мастера, ничего не бронируется само. */
export async function requestVipUrgent(db: Db, tenantId: string, clientId: string, note: string): Promise<boolean> {
  if (!(await isVip(db, tenantId, clientId))) return false;
  if (await one(db, "SELECT 1 x FROM vip_requests WHERE client_id=?1 AND tenant_id=?2 AND status='pending'", [clientId, tenantId])) return true;
  await db.run("INSERT INTO vip_requests(id,tenant_id,client_id,note,created_at) VALUES (?1,?2,?3,?4,?5)", [uuid(), tenantId, clientId, note.slice(0, 500), nowIso()]);
  return true;
}
export async function decideVipRequest(db: Db, tenantId: string, id: string, approve: boolean, masterNote: string, by = "owner"): Promise<boolean> {
  const r = await db.run("UPDATE vip_requests SET status=?3, master_note=?4, decided_at=?5 WHERE id=?1 AND tenant_id=?2 AND status='pending'", [id, tenantId, approve ? "approved" : "declined", masterNote.slice(0, 300), nowIso()]);
  if (!r.changes) return false;
  const a = auditStmt(tenantId, by, approve ? "vip.request_approve" : "vip.request_decline", id); await db.run(a.sql, a.params);
  return true;
}
export const vipRequests = (db: Db, tenantId: string) => safe(() => rows<{ id: string; note: string; status: string; name: string; created_at: string }>(db, "SELECT v.id,v.note,v.status,c.name,v.created_at FROM vip_requests v JOIN clients c ON c.id=v.client_id WHERE v.tenant_id=?1 ORDER BY (v.status='pending') DESC, v.created_at DESC LIMIT 20", [tenantId]), [] as { id: string; note: string; status: string; name: string; created_at: string }[]);
