import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, ownerSetStatus } from "@/lib/booking";
import { addComplaint, addNote, addReview, computeStatus, refreshClientStatuses, resolveComplaint, setClientStatus, setPreferredChannel } from "@/lib/client-model";

const DAY = 86400000;
const base = { intervalDays: 28, createdAt: "2026-01-01T00:00:00Z", hasUpcoming: false };
describe("статусы клиентов по циклу", () => {
  const at = (d: number) => new Date("2026-06-01T00:00:00Z").getTime() + d * DAY;
  it("границы циклов: три пропущенных цикла = потерян", () => {
    const last = "2026-06-01T00:00:00Z";
    const st = (d: number) => computeStatus({ ...base, lastVisit: last, now: new Date(at(d)) });
    expect(st(27)).toBe("active"); expect(st(28)).toBe("overdue"); expect(st(55)).toBe("overdue");
    expect(st(56)).toBe("at_risk"); expect(st(83)).toBe("at_risk"); expect(st(84)).toBe("lost");
  });
  it("запись впереди возвращает в активные", () => {
    expect(computeStatus({ ...base, lastVisit: "2026-01-01T00:00:00Z", hasUpcoming: true, now: new Date(at(300)) })).toBe("active");
  });
});

describe("клиентская модель", () => {
  const withClient = async () => {
    const c = await setup();
    const s = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 30 }))[2];
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: s.startUtc, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    const cl = (await c.db.all<{ id: string }>("SELECT client_id id FROM appointments WHERE id=?1", [r.appointmentId]))[0].id;
    return { c, r, cl, start: s.startUtc };
  };
  it("пересчёт пишет историю, вторая попытка ничего не меняет; потерянный возвращается после визита", async () => {
    const { c, r, cl, start } = await withClient();
    const t1 = new Date(NOW.getTime() + 2 * DAY);
    expect((await refreshClientStatuses(c.db, c.tenantId, t1)).changed).toBe(1);
    expect((await refreshClientStatuses(c.db, c.tenantId, t1)).changed).toBe(0);
    await ownerSetStatus(c.db, { tenantId: c.tenantId, id: r.appointmentId, status: "completed" });
    const far = new Date(new Date(start).getTime() + 100 * DAY);
    await refreshClientStatuses(c.db, c.tenantId, far);
    expect((await c.db.all<{ status: string }>("SELECT status FROM client_state WHERE client_id=?1", [cl]))[0].status).toBe("lost");
    const hist = await c.db.all<{ status: string }>("SELECT status FROM client_status_history WHERE client_id=?1 ORDER BY created_at", [cl]);
    expect(hist.map((h) => h.status)).toEqual(["active", "lost"]);
  });
  it("ручной статус не перетирается пересчётом, но снимается новым визитом", async () => {
    const { c, r, cl, start } = await withClient();
    expect(await setClientStatus(c.db, c.tenantId, cl, "archived", "уехала", "owner")).toBe(true);
    await refreshClientStatuses(c.db, c.tenantId, new Date(NOW.getTime() + 90 * DAY));
    expect((await c.db.all<{ status: string }>("SELECT status FROM client_state WHERE client_id=?1", [cl]))[0].status).toBe("archived");
    await ownerSetStatus(c.db, { tenantId: c.tenantId, id: r.appointmentId, status: "completed" });
    await c.db.run("UPDATE client_state SET status_updated_at='2026-01-01T00:00:00.000Z' WHERE client_id=?1", [cl]);
    await refreshClientStatuses(c.db, c.tenantId, new Date(new Date(start).getTime() + 2 * DAY));
    expect((await c.db.all<{ status: string }>("SELECT status FROM client_state WHERE client_id=?1", [cl]))[0].status).toBe("active");
  });
  it("заметки, жалобы, отзывы, канал: проверка ввода и изоляция салонов", async () => {
    const { c, cl } = await withClient();
    expect(await addNote(c.db, c.tenantId, cl, "health", "аллергия на клей", "owner")).toBe(true);
    expect(await addNote(c.db, c.tenantId, cl, "bogus", "x", "owner")).toBe(false);
    expect(await addNote(c.db, c.tenantId, cl, "other", "   ", "owner")).toBe(false);
    expect(await addNote(c.db, c.tenantB, cl, "other", "чужой салон", "owner")).toBe(false);
    expect(await addComplaint(c.db, c.tenantId, cl, "долго ждала", "owner")).toBe(true);
    const id = (await c.db.all<{ id: string }>("SELECT id FROM complaints"))[0].id;
    expect(await resolveComplaint(c.db, c.tenantB, id, "x", "owner")).toBe(false);
    expect(await resolveComplaint(c.db, c.tenantId, id, "извинились", "owner")).toBe(true);
    expect(await resolveComplaint(c.db, c.tenantId, id, "ещё раз", "owner")).toBe(false);
    expect(await addReview(c.db, c.tenantId, cl, 6, "", "owner")).toBe(false);
    expect(await addReview(c.db, c.tenantId, cl, 5, "супер", "owner")).toBe(true);
    expect(await setPreferredChannel(c.db, c.tenantId, cl, "telegram", "owner")).toBe(false);
    expect(await setPreferredChannel(c.db, c.tenantId, cl, "whatsapp", "owner")).toBe(true);
    expect(await setClientStatus(c.db, c.tenantB, cl, "lost", "", "owner")).toBe(false);
  });
});
