import { auditStmt, one, rows, uuid, type Db } from "./db";

export type ServiceRow = { id: string; slug: string; title_i18n: Record<string, string>; desc_i18n: Record<string, string>; duration_min: number; price_mode: string; price_from_cents: number | null; active: boolean; is_placeholder: boolean };
export type ServiceInput = { id?: string; title: Record<string, string>; desc: Record<string, string>; duration_min: number; price_mode: "unconfirmed" | "from" | "fixed"; price_eur: string; active: boolean };

export const listAllServices = (db: Db, tenantId: string) =>
  rows<ServiceRow>(db, "SELECT id,slug,title_i18n,desc_i18n,duration_min,price_mode,price_from_cents,active,is_placeholder FROM services WHERE tenant_id=?1 ORDER BY active DESC, duration_min", [tenantId]);

/** Цена вводится в евро, хранится целыми центрами. Пустые en/uk подставляются русским текстом, чтобы на сайте не было пустых мест. */
export async function saveService(db: Db, tenantId: string, v: ServiceInput, by = "owner"): Promise<"ok" | "bad" | "price"> {
  const ru = (v.title.ru ?? "").trim().slice(0, 80);
  const dur = Math.round(Number(v.duration_min));
  if (!ru || !(dur >= 15 && dur <= 600) || !["unconfirmed", "from", "fixed"].includes(v.price_mode)) return "bad";
  let cents: number | null = null;
  if (v.price_mode !== "unconfirmed") {
    const n = Number(String(v.price_eur).replace(",", ".").trim());
    if (!Number.isFinite(n) || n <= 0 || n > 100000) return "price";
    cents = Math.round(n * 100);
  }
  const fill = (o: Record<string, string>, max: number) => { const r = (o.ru ?? "").trim().slice(0, max); return { ru: r, en: (o.en ?? "").trim().slice(0, max) || r, uk: (o.uk ?? "").trim().slice(0, max) || r }; };
  const title = fill(v.title, 80), desc = fill(v.desc, 400);
  if (v.id) {
    const own = await one<{ id: string }>(db, "SELECT id FROM services WHERE id=?1 AND tenant_id=?2", [v.id, tenantId]);
    if (!own) return "bad";
    await db.batch([
      { sql: "UPDATE services SET title_i18n=?1,desc_i18n=?2,duration_min=?3,price_mode=?4,price_from_cents=?5,active=?6,is_placeholder=0 WHERE id=?7 AND tenant_id=?8", params: [JSON.stringify(title), JSON.stringify(desc), dur, v.price_mode, cents, v.active ? 1 : 0, v.id, tenantId] },
      auditStmt(tenantId, by, "service.save", v.id),
    ]);
    return "ok";
  }
  const id = uuid();
  await db.batch([
    { sql: "INSERT INTO services(id,tenant_id,slug,title_i18n,desc_i18n,duration_min,buffer_min,price_mode,price_from_cents,active,is_placeholder) VALUES (?1,?2,?3,?4,?5,?6,0,?7,?8,?9,0)", params: [id, tenantId, "s-" + id.slice(0, 8), JSON.stringify(title), JSON.stringify(desc), dur, v.price_mode, cents, v.active ? 1 : 0] },
    auditStmt(tenantId, by, "service.create", id),
  ]);
  return "ok";
}
