import { auditStmt, nowIso, rows, uuid, type Db } from "./db";
import { buildBrief, saveBrief } from "./brief";
import { refreshClientStatuses } from "./client-model";
import { runLifecycle } from "./lifecycle";
import { runLoyalty } from "./loyalty";
import { localParts } from "./tz";
import { getPolicies } from "./policies";

/** Очередь фоновых задач. Правила: у каждой задачи уникальный run_key (повторный запуск ничего не дублирует);
 *  задачу «берёт» один исполнитель (compare-and-set); при ошибке до 3 попыток с паузой; результат и ошибка сохраняются.
 *  Исполнитель вызывается по расписанию (внешний триггер раз в 15 минут) или кнопкой в кабинете. */
export type JobKind = "lifecycle" | "client_status" | "evening_brief" | "loyalty";
export const MAX_ATTEMPTS = 3, BACKOFF_MS = 10 * 60000;
const z2 = (n: number) => String(n).padStart(2, "0");

export type TickResult = { enqueued: number; ran: number; failed: number; skipped: number; ready: boolean };

async function enqueue(db: Db, tenantId: string, kind: JobKind, runKey: string, at: string): Promise<boolean> {
  const r = await db.run("INSERT OR IGNORE INTO jobs(id,tenant_id,kind,run_key,run_after,created_at) VALUES (?1,?2,?3,?4,?5,?6)", [uuid(), tenantId, kind, runKey, at, nowIso()]);
  return r.changes === 1;
}

/** Ставит в очередь задачи, которые пора выполнить сейчас. Ключ содержит временное окно, поэтому повтор в то же окно ничего не добавит. */
export async function planJobs(db: Db, tenantId: string, nowMs: number): Promise<number> {
  const p = localParts(nowMs), day = `${p.y}-${z2(p.mo)}-${z2(p.d)}`, at = new Date(nowMs).toISOString();
  let n = 0;
  if (await enqueue(db, tenantId, "lifecycle", `lifecycle:${tenantId}:${Math.floor(nowMs / (15 * 60000))}`, at)) n++;
  if (await enqueue(db, tenantId, "client_status", `client_status:${tenantId}:${day}`, at)) n++;
  if (await enqueue(db, tenantId, "loyalty", `loyalty:${tenantId}:${Math.floor(nowMs / 3600000)}`, at)) n++;
  const briefHour = (await getPolicies(db, tenantId)).values.brief_hour;
  if (p.h >= briefHour && (await enqueue(db, tenantId, "evening_brief", `evening_brief:${tenantId}:${day}`, at))) n++;
  return n;
}

async function handle(db: Db, tenantId: string, kind: JobKind, nowMs: number): Promise<unknown> {
  if (kind === "lifecycle") { const r = await runLifecycle(db, tenantId, { nowMs, send: true }); return r; }
  if (kind === "client_status") return refreshClientStatuses(db, tenantId, new Date(nowMs));
  if (kind === "loyalty") return runLoyalty(db, tenantId, nowMs);
  if (kind === "evening_brief") { const b = await buildBrief(db, tenantId, nowMs); await saveBrief(db, tenantId, b); return { day: b.day, visits: b.visits.length }; }
  throw new Error(`unknown job kind ${kind}`);
}

/** Выполняет созревшие задачи. Безопасно вызывать параллельно: задачу получает только тот, кто успел сменить статус. */
export async function runDueJobs(db: Db, tenantId: string, nowMs = Date.now()): Promise<TickResult> {
  const res: TickResult = { enqueued: 0, ran: 0, failed: 0, skipped: 0, ready: true };
  try { await rows(db, "SELECT 1 FROM jobs LIMIT 1"); } catch { return { ...res, ready: false }; }
  res.enqueued = await planJobs(db, tenantId, nowMs);
  const due = await rows<{ id: string; kind: JobKind; attempts: number }>(db, "SELECT id,kind,attempts FROM jobs WHERE tenant_id=?1 AND status IN ('queued') AND run_after<=?2 ORDER BY run_after LIMIT 20", [tenantId, new Date(nowMs).toISOString()]);
  for (const j of due) {
    const claim = await db.run("UPDATE jobs SET status='running', attempts=attempts+1 WHERE id=?1 AND status='queued'", [j.id]);
    if (claim.changes !== 1) { res.skipped++; continue; }
    try {
      const out = await handle(db, tenantId, j.kind, nowMs);
      await db.run("UPDATE jobs SET status='done', result=?2, last_error=NULL, finished_at=?3 WHERE id=?1", [j.id, JSON.stringify(out).slice(0, 1000), nowIso()]);
      res.ran++;
    } catch (e) {
      const attempts = j.attempts + 1, final = attempts >= MAX_ATTEMPTS;
      await db.run("UPDATE jobs SET status=?2, last_error=?3, run_after=?4, finished_at=?5 WHERE id=?1", [j.id, final ? "failed" : "queued", String((e as Error).message).slice(0, 300), new Date(nowMs + BACKOFF_MS * attempts).toISOString(), final ? nowIso() : null]);
      res.failed++;
    }
  }
  return res;
}
export async function tickAllTenants(db: Db, nowMs = Date.now()) {
  const ts = await rows<{ id: string }>(db, "SELECT id FROM tenants");
  const total: TickResult = { enqueued: 0, ran: 0, failed: 0, skipped: 0, ready: true };
  for (const t of ts) { const r = await runDueJobs(db, t.id, nowMs); total.enqueued += r.enqueued; total.ran += r.ran; total.failed += r.failed; total.skipped += r.skipped; total.ready = total.ready && r.ready; }
  const a = auditStmt(null, "system", "jobs.tick", undefined, total); await db.run(a.sql, a.params);
  return total;
}
export const recentJobs = async (db: Db, tenantId: string, limit = 12) => rows<{ kind: string; status: string; attempts: number; last_error: string | null; created_at: string }>(db, "SELECT kind,status,attempts,last_error,created_at FROM jobs WHERE tenant_id=?1 ORDER BY created_at DESC LIMIT ?2", [tenantId, limit]).catch(() => []);
export const jobsReady = async (db: Db) => { try { await rows(db, "SELECT 1 FROM jobs LIMIT 1"); return true; } catch { return false; } };
