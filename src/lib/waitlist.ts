import { auditStmt, nowIso, one, uuid, type Db } from "./db";

const norm = (c: string) => (c.includes("@") ? c.trim().toLowerCase() : c.replace(/[^\d+]/g, ""));

/** Запись в лист ожидания из диалога с ИИ. Клиент сам оставил контакт в ответ на предложение ИИ, поэтому согласие на связь отмечается.
 *  Лист ведёт мастер в «Календаре» (таблица из миграции 0005). Дубль по контакту не создаётся. */
export async function addToWaitlist(db: Db, tenantId: string, p: { contact: string; serviceId?: string | null; note?: string; now?: Date }): Promise<"added" | "exists" | "unavailable" | "invalid"> {
  const contact = p.contact.trim().slice(0, 120), cn = norm(contact);
  if (cn.length < 6 || !p.serviceId) return "invalid";
  try {
    const open = await db.all<{ contact: string }>("SELECT contact FROM waitlist WHERE tenant_id=?1 AND status IN ('waiting','offered')", [tenantId]);
    if (open.some((o) => norm(o.contact) === cn)) return "exists";
    const now = p.now ?? new Date(), id = uuid();
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const r = await db.batch([
      { sql: "INSERT INTO waitlist(id,tenant_id,service_id,client_name,contact,day_from,day_to,note,consent_contact,created_at) SELECT ?1,?2,?3,'Клиент из чата ИИ',?4,?5,?6,?7,1,?8 WHERE EXISTS (SELECT 1 FROM services WHERE id=?3 AND tenant_id=?2)", params: [id, tenantId, p.serviceId, contact, day(now), day(new Date(now.getTime() + 60 * 86400000)), (p.note ?? "").slice(0, 300), nowIso()] },
      auditStmt(tenantId, "ai", "waitlist.add", id),
    ]);
    return r[0].changes === 1 ? "added" : "invalid";
  } catch (e) { console.error("waitlist", e); return "unavailable"; }
}
export const hasOpenWaitlist = async (db: Db, tenantId: string, contact: string) =>
  !!(await one(db, "SELECT 1 x FROM waitlist WHERE tenant_id=?1 AND status IN ('waiting','offered') AND contact=?2", [tenantId, contact]));
