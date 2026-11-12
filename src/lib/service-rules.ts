import { rows, type Db } from "./db";

export type ServiceRule = { serviceId: string; weekdays: number[]; earliestMin: number | null; latestMin: number | null; maxPerDay: number | null; bufferBeforeMin: number };
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Правила по услугам. Если таблицы ещё нет в базе (миграция 0005 не применена), все услуги без ограничений. */
export async function getServiceRules(db: Db, tenantId: string): Promise<Map<string, ServiceRule>> {
  const out = new Map<string, ServiceRule>();
  try {
    const r = await rows<{ service_id: string; weekdays: string; earliest_min: number | null; latest_min: number | null; max_per_day: number | null; buffer_before_min: number }>(
      db, "SELECT service_id,weekdays,earliest_min,latest_min,max_per_day,buffer_before_min FROM service_rules WHERE tenant_id=?1", [tenantId]);
    for (const x of r) out.set(x.service_id, { serviceId: x.service_id, weekdays: x.weekdays.split(",").filter((d) => d !== "").map(Number), earliestMin: x.earliest_min, latestMin: x.latest_min, maxPerDay: x.max_per_day, bufferBeforeMin: x.buffer_before_min });
  } catch { /* миграция 0005 ещё не применена */ }
  return out;
}
