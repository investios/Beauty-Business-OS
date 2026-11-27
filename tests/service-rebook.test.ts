import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import { getServiceRebook, saveServiceRebook, rebookDays } from "@/lib/service-rebook";

describe("повторный визит по услугам", () => {
  it("сохраняет срок по услуге, пустое поле возвращает общее правило", async () => {
    const c = await setup(); const [a, b] = c.services;
    expect(await saveServiceRebook(c.db, c.tenantId, { [a.id]: "90", [b.id]: "20" }, "owner")).toEqual({ saved: 2, bad: 0 });
    const m = await getServiceRebook(c.db, c.tenantId);
    expect(rebookDays(m, a.id, 28)).toBe(90); expect(rebookDays(m, b.id, 28)).toBe(20);
    await saveServiceRebook(c.db, c.tenantId, { [a.id]: "" }, "owner");
    expect(rebookDays(await getServiceRebook(c.db, c.tenantId), a.id, 28)).toBe(28);
  });
  it("отклоняет значения вне 7–365 и чужие услуги", async () => {
    const c = await setup(); const a = c.services[0];
    const other = (await c.db.all<{ id: string }>("SELECT id FROM services WHERE tenant_id=?1 LIMIT 1", [c.tenantB]))[0];
    const r = await saveServiceRebook(c.db, c.tenantId, { [a.id]: "3", ...(other ? { [other.id]: "30" } : {}) }, "owner");
    expect(r.saved).toBe(0); expect(r.bad).toBeGreaterThan(0);
    expect((await getServiceRebook(c.db, c.tenantId)).size).toBe(0);
  });
});
