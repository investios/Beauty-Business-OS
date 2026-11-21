import { nowIso, one, uuid, type Db } from "./db";

/** Список «не писать». Отписка, жёсткий отказ почты и жалоба на спам попадают сюда и действуют сразу.
 *  scope 'marketing' блокирует только предложения; 'all' блокирует и служебные письма (например, адрес не существует). */
export const normContact = (c: string) => c.trim().toLowerCase();

export async function suppress(db: Db, tenantId: string, contact: string, reason: "unsubscribe" | "bounce" | "complaint" | "owner", scope: "marketing" | "all" = "marketing") {
  await db.run("INSERT OR IGNORE INTO suppressions(id,tenant_id,contact_norm,scope,reason,created_at) VALUES (?1,?2,?3,?4,?5,?6)", [uuid(), tenantId, normContact(contact), scope, reason, nowIso()]);
}
export async function isSuppressed(db: Db, tenantId: string, contact: string, marketing: boolean): Promise<boolean> {
  try {
    const r = await one(db, `SELECT 1 x FROM suppressions WHERE tenant_id=?1 AND contact_norm=?2 AND (scope='all' ${marketing ? "OR scope='marketing'" : ""}) LIMIT 1`, [tenantId, normContact(contact)]);
    return !!r;
  } catch { return false; }
}
