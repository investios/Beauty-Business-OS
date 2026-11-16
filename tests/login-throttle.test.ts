import { describe, it, expect } from "vitest";
import { setup } from "./helpers";
import { clearLoginFailures, loginAllowed, MAX_GLOBAL, MAX_PER_IP, recordLoginFailure, WINDOW_MS } from "@/lib/login-throttle";

const T = Date.parse("2026-11-16T10:00:00Z");
describe("защита входа в кабинет (в базе)", () => {
  it("с одного адреса: после 5 неудач вход закрыт, чужой адрес не страдает", async () => {
    const { db } = await setup();
    for (let i = 0; i < MAX_PER_IP; i++) { expect(await loginAllowed(db, "1.1.1.1", T)).toBe(true); await recordLoginFailure(db, "1.1.1.1", T + i); }
    expect(await loginAllowed(db, "1.1.1.1", T + 10)).toBe(false);
    expect(await loginAllowed(db, "2.2.2.2", T + 10)).toBe(true);
  });
  it("через 15 минут блокировка снимается", async () => {
    const { db } = await setup();
    for (let i = 0; i < MAX_PER_IP; i++) await recordLoginFailure(db, "1.1.1.1", T);
    expect(await loginAllowed(db, "1.1.1.1", T + WINDOW_MS + 1000)).toBe(true);
  });
  it("успешный вход сбрасывает счётчик этого адреса", async () => {
    const { db } = await setup();
    for (let i = 0; i < 3; i++) await recordLoginFailure(db, "1.1.1.1", T);
    await clearLoginFailures(db, "1.1.1.1");
    for (let i = 0; i < 3; i++) await recordLoginFailure(db, "1.1.1.1", T);
    expect(await loginAllowed(db, "1.1.1.1", T + 1)).toBe(true);
  });
  it("подбор с разных адресов: общий потолок", async () => {
    const { db } = await setup();
    for (let i = 0; i < MAX_GLOBAL; i++) await recordLoginFailure(db, `9.9.9.${i}`, T);
    expect(await loginAllowed(db, "8.8.8.8", T + 1)).toBe(false);
  });
  it("без таблицы (миграция 0008 не применена) вход не ломается", async () => {
    const { db } = await setup();
    await db.run("DROP TABLE login_failures");
    expect(await loginAllowed(db, "1.1.1.1", T)).toBe(true);
    await expect(recordLoginFailure(db, "1.1.1.1", T)).resolves.toBeUndefined();
  });
});
