import { describe, it, expect } from "vitest";
import { setup, NOW, key, person } from "./helpers";
import { createBooking, getAvailability } from "@/lib/booking";
import { planJobs, runDueJobs, MAX_ATTEMPTS } from "@/lib/jobs";
import { buildBrief } from "@/lib/brief";
import { addNote } from "@/lib/client-model";

const T = new Date("2026-11-10T19:30:00Z").getTime(); // 19:30 Дублин (зима): пора вечерней сводки
describe("очередь задач", () => {
  it("идемпотентность: повторное планирование в то же окно ничего не добавляет; сводка только после 19:00", async () => {
    const c = await setup();
    expect(await planJobs(c.db, c.tenantId, T)).toBe(4);
    expect(await planJobs(c.db, c.tenantId, T + 60000)).toBe(0);
    expect(await planJobs(c.db, c.tenantId, new Date("2026-11-10T10:00:00Z").getTime())).toBe(2); // утром: окно lifecycle и часовая задача лояльности
    expect(await c.db.all("SELECT 1 FROM jobs WHERE kind='evening_brief'")).toHaveLength(1);
  });
  it("запуск выполняет задачи один раз; параллельный запуск не дублирует; сводка сохраняется", async () => {
    const c = await setup();
    const [a, b] = await Promise.all([runDueJobs(c.db, c.tenantId, T), runDueJobs(c.db, c.tenantId, T)]);
    expect(a.ran + b.ran).toBe(4);
    expect((await c.db.all<{ status: string }>("SELECT status FROM jobs")).every((j) => j.status === "done")).toBe(true);
    expect(await c.db.all("SELECT 1 FROM daily_briefs WHERE tenant_id=?1", [c.tenantId])).toHaveLength(1);
    expect((await runDueJobs(c.db, c.tenantId, T + 120000)).ran).toBe(0);
  });
  it("ошибка: повтор с паузой, после лимита попыток статус failed и причина сохранена", async () => {
    const c = await setup();
    await planJobs(c.db, c.tenantId, T);
    await c.db.run("UPDATE jobs SET kind='broken' WHERE kind='client_status'");
    let t = T;
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) { await runDueJobs(c.db, c.tenantId, t); t += 3 * 3600000; }
    const j = (await c.db.all<{ status: string; attempts: number; last_error: string }>("SELECT status,attempts,last_error FROM jobs WHERE kind='broken'"))[0];
    expect(j.status).toBe("failed"); expect(j.attempts).toBe(MAX_ATTEMPTS); expect(j.last_error).toMatch(/unknown job kind/);
  });
});
describe("вечерняя сводка", () => {
  it("на завтра: кто придёт, первый визит, важные заметки, что ждёт решения", async () => {
    const c = await setup();
    const day = (await getAvailability(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, now: NOW, days: 5 })).find((s) => s.startUtc.startsWith("2026-11-10"))!;
    const r = await createBooking(c.db, { tenantId: c.tenantId, serviceId: c.consult.id, startsAtUtc: day.startUtc, client: person(), idempotencyKey: key(), consentService: true, now: NOW });
    const cl = (await c.db.all<{ id: string }>("SELECT client_id id FROM appointments WHERE id=?1", [r.appointmentId]))[0].id;
    await addNote(c.db, c.tenantId, cl, "health", "аллергия на клей", "owner");
    await addNote(c.db, c.tenantId, cl, "payment", "платит наличными", "owner");
    const b = await buildBrief(c.db, c.tenantId, new Date("2026-11-09T19:30:00Z").getTime());
    expect(b.day).toBe("2026-11-10"); expect(b.visits).toHaveLength(1);
    expect(b.visits[0].first).toBe(true); expect(b.visits[0].notes).toEqual(["аллергия на клей"]); // оплата в сводку не попадает
    const empty = await buildBrief(c.db, c.tenantB, new Date("2026-11-09T19:30:00Z").getTime());
    expect(empty.visits).toHaveLength(0);
  });
});
