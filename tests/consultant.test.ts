import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, ownerSetStatus } from "@/lib/booking";
import { makeConsultantSession, makeSession, readConsultantSession, readSession, consultantPassword } from "@/lib/auth";
import { addConsultantNote, compute, consultantNotes } from "@/lib/consulting";

describe("роль консультанта", () => {
  it("сессии разных ролей не взаимозаменяемы; подделка и истёкший срок не проходят", () => {
    const o = makeSession("t1"), c = makeConsultantSession("t1");
    expect(readSession(o)).toEqual({ tenantId: "t1" }); expect(readConsultantSession(c)).toEqual({ tenantId: "t1" });
    expect(readSession(c)).toBeNull(); expect(readConsultantSession(o)).toBeNull();
    expect(readConsultantSession(c.slice(0, -2) + "xx")).toBeNull(); expect(readConsultantSession(undefined)).toBeNull();
  });
  it("в боевой среде без пароля вход консультанта выключен", () => {
    const env = process.env as Record<string, string | undefined>; const old = [env.NODE_ENV, env.CONSULTANT_PASSWORD];
    env.NODE_ENV = "production"; delete env.CONSULTANT_PASSWORD;
    expect(consultantPassword()).toBeNull();
    env.CONSULTANT_PASSWORD = "x-long-password"; expect(consultantPassword()).toBe("x-long-password");
    env.NODE_ENV = old[0]; if (old[1] === undefined) delete env.CONSULTANT_PASSWORD; else env.CONSULTANT_PASSWORD = old[1];
  });
});
describe("аналитика консультанта", () => {
  it("считает агрегаты, не раскрывает имён и контактов, заметки изолированы по салону", async () => {
    const c = await setup();
    const slots = await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 });
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) { const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: slots[i * 2].startUtc, client: person(i), idempotencyKey: key(), consentService: true, now: NOW }); ids.push(r.appointmentId); }
    await ownerSetStatus(c.db, { tenantId: c.tenantId, id: ids[0], status: "completed" });
    await ownerSetStatus(c.db, { tenantId: c.tenantId, id: ids[1], status: "no_show" });
    const a = await compute(c.db, c.tenantId, NOW.getTime() + 86400000);
    expect(a.created).toBe(3); expect(a.completed).toBe(1); expect(a.noShow).toBe(1); expect(a.noShowPct).toBe(50);
    expect(a.signals.length).toBeGreaterThan(0);
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/@example/); for (let i = 0; i < 3; i++) expect(json).not.toContain(person(i).name);
    expect(await addConsultantNote(c.db, c.tenantId, "Идея: депозит")).toBe(true);
    expect(await addConsultantNote(c.db, c.tenantId, "  ")).toBe(false);
    expect((await consultantNotes(c.db, c.tenantId))!.length).toBe(1); expect((await consultantNotes(c.db, c.tenantB))!.length).toBe(0);
    const other = await compute(c.db, c.tenantB, NOW.getTime()); expect(other.created).toBe(0);
  });
});
