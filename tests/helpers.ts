import { createSqlite } from "@/lib/db";
import { createTenant } from "@/lib/seed";
import { listServices } from "@/lib/booking";

export const NOW = new Date("2026-11-09T08:00:00Z");

export async function setup() {
  const db = await createSqlite(":memory:");
  const tenantId = await createTenant(db, { slug: "a", name: "A" });
  const tenantB = await createTenant(db, { slug: "b", name: "B" });
  const services = await listServices(db, tenantId);
  const consult = services.find((s) => s.slug === "consultation")!;
  return { db, tenantId, tenantB, consult, services };
}
let n = 0;
export const key = () => `test-key-${Date.now()}-${++n}-xxxx`;
export const person = (i = 1) => ({ name: `Test Client ${i}`, contact: `client${i}@example.com`, locale: "en" });
