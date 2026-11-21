import { nowIso, uuid, type Db } from "./db";

/** Статусы доставки различаются: queued → sent → delivered, либо failed / suppressed.
 *  Переход только вперёд (события провайдера могут прийти не по порядку). «sent» не значит «доставлено». */
export type DeliveryState = "queued" | "sent" | "delivered" | "failed" | "suppressed";
const RANK: Record<DeliveryState, number> = { queued: 0, sent: 1, delivered: 2, failed: 2, suppressed: 2 };

export async function recordDelivery(db: Db, tenantId: string, notificationId: string, status: DeliveryState, providerEvent?: string): Promise<boolean> {
  try {
    const r = await db.run("INSERT OR IGNORE INTO message_events(id,tenant_id,notification_id,status,provider_event,at) VALUES (?1,?2,?3,?4,?5,?6)",
      [uuid(), tenantId, notificationId, status, providerEvent ?? null, nowIso()]);
    return r.changes === 1;
  } catch { return false; }
}
/** Текущее состояние = самое «дальнее» из записанных */
export async function currentDelivery(db: Db, tenantId: string, notificationId: string): Promise<DeliveryState | null> {
  try {
    const ev = await db.all<{ status: DeliveryState }>("SELECT status FROM message_events WHERE tenant_id=?1 AND notification_id=?2", [tenantId, notificationId]);
    if (!ev.length) return null;
    return ev.reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a)).status;
  } catch { return null; }
}
