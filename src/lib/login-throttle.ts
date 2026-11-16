import { one, uuid, type Db } from "@/lib/db";

/** Окно подсчёта и пороги. С одного адреса — 5 неудач за 15 минут; со всех адресов вместе — 40 (защита от подбора «с разных адресов»). */
export const WINDOW_MS = 15 * 60_000;
export const MAX_PER_IP = 5;
export const MAX_GLOBAL = 40;

/** Можно ли сейчас пробовать войти. Если таблицы ещё нет (миграция 0008 не применена) — не блокируем, работает только лимит в памяти. */
export async function loginAllowed(db: Db, ip: string, now = Date.now()): Promise<boolean> {
  try {
    const since = new Date(now - WINDOW_MS).toISOString();
    const a = await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM login_failures WHERE ip = ? AND created_at >= ?", [ip, since]);
    if ((a?.n ?? 0) >= MAX_PER_IP) return false;
    const g = await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM login_failures WHERE created_at >= ?", [since]);
    return (g?.n ?? 0) < MAX_GLOBAL;
  } catch { return true; }
}

export async function recordLoginFailure(db: Db, ip: string, now = Date.now()): Promise<void> {
  try {
    await db.run("INSERT INTO login_failures (id, ip, created_at) VALUES (?, ?, ?)", [uuid(), ip, new Date(now).toISOString()]);
    await db.run("DELETE FROM login_failures WHERE created_at < ?", [new Date(now - 24 * 3600_000).toISOString()]);
  } catch { /* таблицы нет: ничего страшного */ }
}

export async function clearLoginFailures(db: Db, ip: string): Promise<void> {
  try { await db.run("DELETE FROM login_failures WHERE ip = ?", [ip]); } catch { /* нет таблицы */ }
}
