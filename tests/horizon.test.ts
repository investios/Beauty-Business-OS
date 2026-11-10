import { describe, it, expect } from "vitest";
import { setup, NOW } from "./helpers";
import { getAvailability } from "@/lib/booking";

describe("календарь на полгода вперёд", () => {
  it("даты и часы бьются через весь горизонт, в том числе через переход на летнее время (28 марта 2027)", async () => {
    const c = await setup();
    const all = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 183 });
    const first = (day: string) => all.find((s) => s.startUtc.startsWith(day))?.startUtc;
    expect(first("2027-03-23")).toBe("2027-03-23T10:00:00.000Z"); // зима: 10:00 местного = 10:00 UTC
    expect(first("2027-03-30")).toBe("2027-03-30T09:00:00.000Z"); // лето: 10:00 местного = 09:00 UTC
    const last = all[all.length - 1].startUtc.slice(0, 10);
    expect(last >= "2027-05-01").toBe(true); // слоты доходят минимум до мая 2027
    // у сетки нет дублей и пропусков порядка
    const keys = all.map((s) => s.startUtc); expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(keys);
  });
});
