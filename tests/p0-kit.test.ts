import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { getAvailability, createBooking, ownerSetStatus } from "@/lib/booking";
import { getMasterState, setMasterState, isBusyState, isMasterBusy } from "@/lib/master-state";
import { suppress, isSuppressed } from "@/lib/suppression";
import { recordDelivery, currentDelivery } from "@/lib/delivery";
import { runLifecycle } from "@/lib/lifecycle";
import { setPolicy, getPolicies } from "@/lib/policies";
import { planJobs } from "@/lib/jobs";
import { addComplaint, resolveComplaint } from "@/lib/client-model";

describe("состояние мастера", () => {
  it("по умолчанию на связи; на процедуре — занят; срок вышел — снова на связи; мусор отклоняется", async () => {
    const c = await setup();
    expect((await getMasterState(c.db, c.tenantId)).state).toBe("available");
    expect(await setMasterState(c.db, c.tenantId, "in_procedure", new Date(NOW.getTime() + 3600000).toISOString())).toBe(true);
    expect((await getMasterState(c.db, c.tenantId, NOW.getTime())).state).toBe("in_procedure");
    expect(await isMasterBusy(c.db, c.tenantId, NOW.getTime())).toBe(true);
    expect((await getMasterState(c.db, c.tenantId, NOW.getTime() + 2 * 3600000)).state).toBe("available");
    expect(await setMasterState(c.db, c.tenantId, "hacker", null)).toBe(false);
    expect(isBusyState("break")).toBe(false);
  });
  it("состояния салонов не смешиваются", async () => {
    const c = await setup();
    await setMasterState(c.db, c.tenantId, "dnd", null);
    expect((await getMasterState(c.db, c.tenantB)).state).toBe("available");
  });
});

describe("список «не писать» и статусы доставки", () => {
  it("маркетинговая отписка не блокирует служебные; жёсткий отказ блокирует всё", async () => {
    const c = await setup();
    await suppress(c.db, c.tenantId, "A@Example.com", "unsubscribe");
    expect(await isSuppressed(c.db, c.tenantId, "a@example.com", true)).toBe(true);
    expect(await isSuppressed(c.db, c.tenantId, "a@example.com", false)).toBe(false);
    await suppress(c.db, c.tenantId, "a@example.com", "bounce", "all");
    expect(await isSuppressed(c.db, c.tenantId, "a@example.com", false)).toBe(true);
    expect(await isSuppressed(c.db, c.tenantB, "a@example.com", true)).toBe(false);
  });
  it("доставка идёт только вперёд: delivered не откатывается в sent", async () => {
    const c = await setup();
    expect(await recordDelivery(c.db, c.tenantId, "n1", "delivered")).toBe(true);
    await recordDelivery(c.db, c.tenantId, "n1", "sent");
    expect(await currentDelivery(c.db, c.tenantId, "n1")).toBe("delivered");
    expect(await recordDelivery(c.db, c.tenantId, "n1", "delivered")).toBe(false);
    expect(await currentDelivery(c.db, c.tenantId, "nope")).toBeNull();
  });
});

describe("время вечерней сводки", () => {
  it("мастер выбирает час; до него задача не ставится, после — ставится", async () => {
    const c = await setup();
    expect((await getPolicies(c.db, c.tenantId)).values.brief_hour).toBe(19);
    expect((await setPolicy(c.db, c.tenantId, "brief_hour", 21, "owner")).ok).toBe(true);
    expect((await setPolicy(c.db, c.tenantId, "brief_hour", 5, "owner")).ok).toBe(false);
    const at = (h: number) => new Date(`2026-11-09T${String(h).padStart(2, "0")}:05:00Z`).getTime(); // ноябрь: Дублин = UTC
    const kinds = async () => (await c.db.all<{ kind: string }>("SELECT kind FROM jobs WHERE tenant_id=?1", [c.tenantId])).map((x) => x.kind);
    await planJobs(c.db, c.tenantId, at(20));
    expect(await kinds()).not.toContain("evening_brief");
    await planJobs(c.db, c.tenantId, at(21));
    expect(await kinds()).toContain("evening_brief");
  });
});

describe("открытая жалоба останавливает цепочку продаж", () => {
  it("follow-up ждёт, пока жалоба не решена, потом уходит в очередь обработки", async () => {
    const c = await setup();
    const slot = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 5 }))[0];
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: slot.startUtc, client: person(3), idempotencyKey: key(), consentService: true, now: NOW });
    await ownerSetStatus(c.db, { tenantId: c.tenantId, id: r.appointmentId, status: "completed" });
    const cid = (await c.db.all<{ client_id: string }>("SELECT client_id FROM appointments WHERE id=?1", [r.appointmentId]))[0].client_id;
    expect(await addComplaint(c.db, c.tenantId, cid, "Недовольна результатом", "owner")).toBe(true);
    const noon = new Date(new Date(new Date(slot.startUtc).getTime() + 48 * 3600000).toISOString().slice(0, 10) + "T12:00:00Z").getTime(); // полдень, вне тихих часов
    const a = await runLifecycle(c.db, c.tenantId, { nowMs: noon, send: false });
    expect(a.simulated).toBe(0);
    expect(a.waiting).toBeGreaterThan(0);
    const id = (await c.db.all<{ id: string }>("SELECT id FROM complaints WHERE tenant_id=?1", [c.tenantId]))[0].id;
    await resolveComplaint(c.db, c.tenantId, id, "Исправили", "owner");
    const b = await runLifecycle(c.db, c.tenantId, { nowMs: noon, send: false });
    expect(b.simulated).toBeGreaterThan(0);
  });
});
