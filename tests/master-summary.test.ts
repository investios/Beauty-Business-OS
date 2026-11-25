import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { masterSummary, summaryCsv } from "@/lib/master-summary";

const day = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

async function seed(c: Awaited<ReturnType<typeof setup>>, tenantId: string, tag: string) {
  const staff = (await c.db.all<{ id: string }>("SELECT id FROM staff WHERE tenant_id=?1 LIMIT 1", [tenantId]))[0];
  const svc = (await c.db.all<{ id: string }>("SELECT id FROM services WHERE tenant_id=?1 LIMIT 1", [tenantId]))[0];
  let i = 0;
  const client = async (ago: number) => { const id = `${tag}-c${++i}`; await c.db.run("INSERT INTO clients (id,tenant_id,name,contact,contact_norm,created_at) VALUES (?1,?2,?3,?4,?4,?5)", [id, tenantId, "N" + i, `${tag}${i}@x.test`, day(ago)]); return id; };
  const appt = async (cid: string, ago: number, st: string) => { const id = `${tag}-a${++i}`; await c.db.run("INSERT INTO appointments (id,tenant_id,client_id,staff_id,service_id,start_at,end_at,blocked_until,status,idempotency_key,manage_token,created_at) VALUES (?1,?2,?3,?4,?5,?6,?6,?6,?7,?1,?1,?6)", [id, tenantId, cid, staff.id, svc.id, day(ago), st]); };
  const a = await client(10), b = await client(20), old = await client(60);
  await appt(a, 5, "completed"); await appt(a, 3, "completed"); await appt(b, 8, "completed"); await appt(b, 9, "cancelled"); await appt(old, 12, "no_show");
}

describe("сводка для мастера", () => {
  it("считает клиентов, визиты и повторные", async () => {
    const c = await setup(); await seed(c, c.tenantId, "a");
    const s = await masterSummary(c.db, c.tenantId, NOW.getTime(), 30);
    expect(s.clientsNew).toBe(2); expect(s.clientsPrev).toBe(1);
    expect(s.growthPct).toBe(100);
    expect(s.completed).toBe(3); expect(s.cancelled).toBe(1); expect(s.noShow).toBe(1);
    expect(s.returning).toBe(1); expect(s.withVisit).toBe(2); expect(s.repeatPct).toBe(50);
    expect(s.services[0].n).toBe(3);
  });
  it("не смешивает данные разных тенантов", async () => {
    const c = await setup(); await seed(c, c.tenantId, "a");
    const s = await masterSummary(c.db, c.tenantB, NOW.getTime(), 30);
    expect(s.clientsTotal).toBe(0); expect(s.completed).toBe(0);
  });
  it("в таблице нет внутренних данных консультанта", async () => {
    const c = await setup(); await seed(c, c.tenantId, "a");
    const s = await masterSummary(c.db, c.tenantId, NOW.getTime(), 90);
    const csv = summaryCsv(s);
    expect(csv).toContain("Клиентов всего");
    expect(JSON.stringify(s) + csv).not.toMatch(/signal|handoff|source|engine|intent|transcript|loyalty|алгоритм/i);
  });
});
