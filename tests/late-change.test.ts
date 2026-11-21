import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability, cancelBooking, getBookingByToken, BookingError } from "@/lib/booking";
import { lateChangeHandoff } from "@/lib/late-change";

async function nearBooking(c: Awaited<ReturnType<typeof setup>>) {
  const near = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 3 })).find((x) => { const t = new Date(x.startUtc).getTime(); return t > NOW.getTime() + 3600000 && t < NOW.getTime() + 11 * 3600000; })!;
  return createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: near.startUtc, client: person(7), idempotencyKey: key(), consentService: true, now: NOW });
}

describe("позднее изменение со страницы записи", () => {
  it("запись остаётся, мастеру приходит один вопрос с контактом клиента, повтор не дублирует", async () => {
    const c = await setup(); const r = await nearBooking(c);
    await expect(cancelBooking(c.db, c.tenantId, r.appointmentId, r.manageToken, NOW)).rejects.toMatchObject({ code: "too_late" } satisfies Partial<BookingError>);
    expect(await lateChangeHandoff(c.db, c.tenantId, r.appointmentId, "cancel")).toBe(true);
    expect(await lateChangeHandoff(c.db, c.tenantId, r.appointmentId, "cancel")).toBe(true);
    const hs = await c.db.all<{ reason: string; contact: string; summary: string; status: string }>("SELECT reason,contact,summary,status FROM handoffs WHERE tenant_id=?1", [c.tenantId]);
    expect(hs.length).toBe(1);
    expect(hs[0]).toMatchObject({ reason: "late_change", status: "open", contact: "client7@example.com" });
    expect(hs[0].summary).toMatch(/отменить/);
    expect((await getBookingByToken(c.db, c.tenantId, r.appointmentId, r.manageToken))!.status).toBe("confirmed");
    expect((await c.db.all<{ channel: string }>("SELECT channel FROM conversations WHERE id=?1", [`late-${r.appointmentId}`]))[0].channel).toBe("manage");
  });
  it("чужой салон и неизвестная запись ничего не создают", async () => {
    const c = await setup(); const r = await nearBooking(c);
    expect(await lateChangeHandoff(c.db, c.tenantB, r.appointmentId, "reschedule")).toBe(false);
    expect(await lateChangeHandoff(c.db, c.tenantId, "00000000-0000-0000-0000-000000000000", "reschedule")).toBe(false);
    expect((await c.db.all("SELECT 1 FROM handoffs")).length).toBe(0);
  });
});
