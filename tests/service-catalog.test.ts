import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import { saveService, listAllServices } from "@/lib/service-catalog";
import { listServices } from "@/lib/booking";

const base = { title: { ru: "Стрижка", en: "", uk: "" }, desc: { ru: "Описание", en: "", uk: "" }, duration_min: 45, price_mode: "from" as const, price_eur: "35,50", active: true };

describe("каталог услуг мастера", () => {
  it("добавляет услугу: цена в центах, пустые языки берут русский, сразу видна в записи", async () => {
    const c = await setup();
    expect(await saveService(c.db, c.tenantId, base)).toBe("ok");
    const s = (await listServices(c.db, c.tenantId)).find((x) => x.title_i18n.ru === "Стрижка")!;
    expect(s.price_from_cents).toBe(3550); expect(s.title_i18n.en).toBe("Стрижка"); expect(s.is_placeholder).toBeFalsy();
  });
  it("скрытая услуга пропадает из записи, но остаётся в каталоге", async () => {
    const c = await setup(); await saveService(c.db, c.tenantId, base);
    const s = (await listAllServices(c.db, c.tenantId)).find((x) => x.title_i18n.ru === "Стрижка")!;
    await saveService(c.db, c.tenantId, { ...base, id: s.id, active: false });
    expect((await listServices(c.db, c.tenantId)).some((x) => x.id === s.id)).toBe(false);
    expect((await listAllServices(c.db, c.tenantId)).some((x) => x.id === s.id)).toBe(true);
  });
  it("отклоняет плохие данные и чужую услугу", async () => {
    const c = await setup();
    expect(await saveService(c.db, c.tenantId, { ...base, title: { ru: " ", en: "", uk: "" } })).toBe("bad");
    expect(await saveService(c.db, c.tenantId, { ...base, duration_min: 5 })).toBe("bad");
    expect(await saveService(c.db, c.tenantId, { ...base, price_eur: "abc" })).toBe("price");
    expect(await saveService(c.db, c.tenantId, { ...base, price_eur: "0" })).toBe("price");
    const other = (await c.db.all<{ id: string }>("SELECT id FROM services WHERE tenant_id=?1 LIMIT 1", [c.tenantB]))[0];
    if (other) expect(await saveService(c.db, c.tenantId, { ...base, id: other.id })).toBe("bad");
  });
  it("без цены режим «не показывать» не хранит сумму", async () => {
    const c = await setup();
    await saveService(c.db, c.tenantId, { ...base, price_mode: "unconfirmed", price_eur: "" });
    const s = (await listAllServices(c.db, c.tenantId)).find((x) => x.title_i18n.ru === "Стрижка")!;
    expect(s.price_from_cents).toBeNull();
  });
});
