import { auditStmt, nowIso, rows, type Db } from "./db";

/** Срок повторного визита по услугам. Если таблицы ещё нет или для услуги не задано, возвращается пусто и работает общее правило. */
export async function getServiceRebook(db: Db, tenantId: string): Promise<Map<string, number>> {
  try {
    const rs = await rows<{ service_id: string; days: number }>(db, "SELECT service_id,days FROM service_rebook WHERE tenant_id=?1", [tenantId]);
    return new Map(rs.map((r) => [r.service_id, Number(r.days)]));
  } catch { return new Map(); }
}

export const rebookDays = (m: Map<string, number>, serviceId: string | null | undefined, fallback: number) => (serviceId && m.get(serviceId)) || fallback;

/** values: serviceId → число дней или пусто (вернуть общее правило). Чужие услуги и значения вне 7–365 пропускаются. */
export async function saveServiceRebook(db: Db, tenantId: string, values: Record<string, string>, by: string): Promise<{ saved: number; bad: number }> {
  const own = new Set((await rows<{ id: string }>(db, "SELECT id FROM services WHERE tenant_id=?1", [tenantId])).map((s) => s.id));
  const at = nowIso(); let saved = 0, bad = 0; const st = [];
  for (const [id, raw] of Object.entries(values)) {
    if (!own.has(id)) { bad++; continue; }
    const t = String(raw).trim();
    if (t === "") { st.push({ sql: "DELETE FROM service_rebook WHERE tenant_id=?1 AND service_id=?2", params: [tenantId, id] }); saved++; continue; }
    const n = Number(t);
    if (!Number.isInteger(n) || n < 7 || n > 365) { bad++; continue; }
    st.push({ sql: "INSERT INTO service_rebook(tenant_id,service_id,days,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(tenant_id,service_id) DO UPDATE SET days=?3,updated_at=?4", params: [tenantId, id, n, at] }); saved++;
  }
  if (st.length) await db.batch([...st, auditStmt(tenantId, by, "service_rebook.save", "", { saved, bad })]);
  return { saved, bad };
}
