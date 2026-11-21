import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { canUse, setApproval, approvals, setStage, FAMILIES, getFamily } from "@/lib/playbooks";
import { getAvailability, createBooking } from "@/lib/booking";
import { addComplaint } from "@/lib/client-model";

async function client(c: Awaited<ReturnType<typeof setup>>) {
  const slot = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 5 }))[0];
  const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: slot.startUtc, client: person(5), idempotencyKey: key(), consentService: true, now: NOW });
  return (await c.db.all<{ client_id: string }>("SELECT client_id FROM appointments WHERE id=?1", [r.appointmentId]))[0].client_id;
}

describe("шлюз сценариев", () => {
  it("без утверждения мастером сценарий запрещён; после — разрешён; отзыв утверждения возвращает запрет", async () => {
    const c = await setup();
    expect((await canUse(c.db, c.tenantId, "SC15")).reason).toBe("not_approved_by_owner");
    await setApproval(c.db, c.tenantId, "SC15", true);
    expect(await canUse(c.db, c.tenantId, "SC15")).toEqual({ allowed: true, reason: "ok" });
    await setApproval(c.db, c.tenantId, "SC15", false);
    expect((await canUse(c.db, c.tenantId, "SC15")).allowed).toBe(false);
    expect(await setApproval(c.db, c.tenantId, "SC99", true)).toBe(false);
  });
  it("утверждение одного салона не действует на другой", async () => {
    const c = await setup(); await setApproval(c.db, c.tenantId, "SC10", true);
    expect(Object.keys(await approvals(c.db, c.tenantB))).toHaveLength(0);
    expect((await canUse(c.db, c.tenantB, "SC10")).allowed).toBe(false);
  });
  it("открытая жалоба блокирует даже утверждённый сценарий", async () => {
    const c = await setup(); const cid = await client(c);
    await setApproval(c.db, c.tenantId, "SC20", true);
    await c.db.run("INSERT INTO consents(id,tenant_id,client_id,purpose,channel,policy_version,granted_at) VALUES ('m1',?1,?2,'marketing','email','v1','2026-11-09T00:00:00Z')", [c.tenantId, cid]);
    expect((await canUse(c.db, c.tenantId, "SC20", { clientId: cid })).allowed).toBe(true);
    await addComplaint(c.db, c.tenantId, cid, "Недовольна", "owner");
    expect((await canUse(c.db, c.tenantId, "SC20", { clientId: cid })).reason).toBe("open_complaint");
  });
  it("рекламный сценарий без согласия на предложения запрещён, после отзыва согласия — тоже", async () => {
    const c = await setup(); const cid = await client(c);
    await setApproval(c.db, c.tenantId, "SC22", true);
    expect((await canUse(c.db, c.tenantId, "SC22", { clientId: cid })).reason).toBe("no_marketing_consent");
    await c.db.run("INSERT INTO consents(id,tenant_id,client_id,purpose,channel,policy_version,granted_at) VALUES ('m2',?1,?2,'marketing','email','v1','2026-11-09T00:00:00Z')", [c.tenantId, cid]);
    expect((await canUse(c.db, c.tenantId, "SC22", { clientId: cid })).allowed).toBe(true);
    await c.db.run("UPDATE consents SET withdrawn_at='2026-11-10T00:00:00Z' WHERE id='m2'");
    expect((await canUse(c.db, c.tenantId, "SC22", { clientId: cid })).allowed).toBe(false);
  });
  it("каждое решение записывается; стадия беседы сохраняется, мусорная отклоняется", async () => {
    const c = await setup();
    await canUse(c.db, c.tenantId, "SC03");
    expect((await c.db.all("SELECT 1 FROM message_decision WHERE tenant_id=?1", [c.tenantId])).length).toBe(1);
    await c.db.run("INSERT INTO conversations(id,tenant_id,channel,locale,created_at) VALUES ('cv1',?1,'web','ru','2026-11-09T00:00:00Z')", [c.tenantId]).catch(() => null);
    expect(await setStage(c.db, c.tenantId, "cv1", "objection" as never, { objection: "dear" })).toBe(true);
    expect(await setStage(c.db, c.tenantId, "cv1", "bogus" as never)).toBe(false);
    expect(getFamily("SC01")).not.toBeNull(); expect(FAMILIES).toHaveLength(30);
  });
});
