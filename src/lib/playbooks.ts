import { auditStmt, nowIso, one, rows, uuid, type Db } from "./db";
import catalog from "@/data/playbooks.json";

/** Библиотека сценариев Sales Lite. Тексты — черновики из каталога; в работу попадает только утверждённое мастером.
 *  Сейчас сценарии НЕ подключены к исходящим сообщениям: это реестр, шлюз решений и стадия беседы (см. docs/kit-2026-11-21/sales). */
export type Family = (typeof catalog.families)[number];
export const CATALOG_VERSION = catalog.version;
export const FAMILIES: Family[] = catalog.families;
export const getFamily = (id: string) => FAMILIES.find((f) => f.id === id) ?? null;

export const STAGES = ["lead_new", "qualifying", "price", "objection", "booking", "reminder", "pre_visit", "post_visit", "complaint", "review", "aftercare", "rebook_eligible", "reactivation", "lost", "complaint_suppressed"] as const;
export type Stage = (typeof STAGES)[number];

const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };

export async function approvals(db: Db, tenantId: string): Promise<Record<string, { status: string; version: string; at: string }>> {
  const r = await safe(() => rows<{ family_id: string; status: string; catalog_version: string; decided_at: string }>(db, "SELECT family_id,status,catalog_version,decided_at FROM playbook_approval WHERE tenant_id=?1", [tenantId]), []);
  return Object.fromEntries(r.map((x) => [x.family_id, { status: x.status, version: x.catalog_version, at: x.decided_at }]));
}
export async function setApproval(db: Db, tenantId: string, familyId: string, approve: boolean, by = "owner"): Promise<boolean> {
  if (!getFamily(familyId)) return false;
  await db.batch([
    { sql: `INSERT INTO playbook_approval(tenant_id,family_id,catalog_version,status,approved_by,decided_at) VALUES (?1,?2,?3,?4,?5,?6)
      ON CONFLICT(tenant_id,family_id) DO UPDATE SET catalog_version=?3,status=?4,approved_by=?5,decided_at=?6`, params: [tenantId, familyId, CATALOG_VERSION, approve ? "approved" : "revoked", by, nowIso()] },
    auditStmt(tenantId, by, approve ? "playbook.approve" : "playbook.revoke", familyId, { version: CATALOG_VERSION }),
  ]);
  return true;
}

export type Gate = { allowed: boolean; reason: string };
/** Шлюз решения: можно ли использовать сценарий для этого клиента сейчас. Всё, что не доказано, запрещено. */
export async function canUse(db: Db, tenantId: string, familyId: string, o: { clientId?: string | null; conversationId?: string | null } = {}): Promise<Gate> {
  const fam = getFamily(familyId);
  const decide = async (g: Gate) => {
    await safe(() => db.run("INSERT INTO message_decision(id,tenant_id,conversation_id,family_id,allowed,reason,at) VALUES (?1,?2,?3,?4,?5,?6,?7)", [uuid(), tenantId, o.conversationId ?? null, familyId, g.allowed ? 1 : 0, g.reason, nowIso()]), null);
    return g;
  };
  if (!fam) return decide({ allowed: false, reason: "unknown_family" });
  const a = (await approvals(db, tenantId))[familyId];
  if (!a || a.status !== "approved") return decide({ allowed: false, reason: "not_approved_by_owner" });
  if (a.version !== CATALOG_VERSION) return decide({ allowed: false, reason: "catalog_changed_after_approval" });
  if (o.clientId) {
    if (await safe(() => one(db, "SELECT 1 x FROM complaints WHERE client_id=?1 AND tenant_id=?2 AND status='open' LIMIT 1", [o.clientId!, tenantId]), null)) return decide({ allowed: false, reason: "open_complaint" });
    if (fam.requires_marketing_consent && !(await safe(() => one(db, "SELECT 1 x FROM consents WHERE client_id=?1 AND tenant_id=?2 AND purpose='marketing' AND withdrawn_at IS NULL LIMIT 1", [o.clientId!, tenantId]), null))) return decide({ allowed: false, reason: "no_marketing_consent" });
  } else if (fam.requires_marketing_consent) return decide({ allowed: false, reason: "no_marketing_consent" });
  return decide({ allowed: true, reason: "ok" });
}

export async function setStage(db: Db, tenantId: string, conversationId: string, stage: Stage, o: { familyId?: string; objection?: string; suppressed?: string; next?: string } = {}) {
  if (!(STAGES as readonly string[]).includes(stage)) return false;
  await db.run(`INSERT INTO conversation_state(conversation_id,tenant_id,stage,family_id,objection,suppressed_reason,next_action,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
    ON CONFLICT(conversation_id) DO UPDATE SET stage=?3,family_id=?4,objection=?5,suppressed_reason=?6,next_action=?7,updated_at=?8`,
    [conversationId, tenantId, stage, o.familyId ?? null, o.objection ?? null, o.suppressed ?? null, o.next ?? null, nowIso()]);
  return true;
}
