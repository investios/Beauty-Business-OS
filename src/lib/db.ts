import { mkdirSync, readdirSync, readFileSync } from "node:fs";

// Единый интерфейс базы: Cloudflare D1 в продакшне, локальный SQLite (node:sqlite) в тестах и разработке.
// Многошаговых транзакций в D1 нет, поэтому атомарность даёт batch(): все запросы пачки выполняются как один блок.
export type Param = string | number | null;
export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T[]>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  batch(stmts: { sql: string; params?: Param[] }[]): Promise<{ changes: number }[]>;
}
export type Q = Db;

const JSON_COLS = new Set(["title_i18n", "desc_i18n", "source", "created_from", "snapshot", "forbidden", "diff", "meta"]);
const BOOL_COLS = new Set(["is_demo", "active", "is_placeholder", "enabled"]);
function norm<T>(row: Record<string, unknown>): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (JSON_COLS.has(k) && typeof v === "string") { try { o[k] = JSON.parse(v); } catch { o[k] = v; } }
    else if (BOOL_COLS.has(k) && (v === 0 || v === 1)) o[k] = v === 1;
    else o[k] = v;
  }
  return o as T;
}
export const nowIso = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();
export const js = (v: unknown) => JSON.stringify(v);

/* ---------- Cloudflare D1 ---------- */
interface D1Stmt { bind(...p: unknown[]): D1Stmt; all(): Promise<{ results: Record<string, unknown>[] }>; run(): Promise<{ meta: { changes: number } }> }
interface D1Like { prepare(sql: string): D1Stmt; batch(s: D1Stmt[]): Promise<{ meta: { changes: number } }[]> }
export class D1Db implements Db {
  constructor(private d1: D1Like) {}
  async all<T>(sql: string, params: Param[] = []) { return (await this.d1.prepare(sql).bind(...params).all()).results.map((r) => norm<T>(r)); }
  async run(sql: string, params: Param[] = []) { const r = await this.d1.prepare(sql).bind(...params).run(); return { changes: r.meta.changes }; }
  async batch(stmts: { sql: string; params?: Param[] }[]) {
    const rs = await this.d1.batch(stmts.map((s) => this.d1.prepare(s.sql).bind(...(s.params ?? []))));
    return rs.map((r) => ({ changes: r.meta.changes }));
  }
}

/* ---------- локальный SQLite ---------- */
type RawSqlite = { exec(sql: string): void; prepare(sql: string): { all(...p: unknown[]): Record<string, unknown>[]; run(...p: unknown[]): { changes: number | bigint } } };
export class SqliteDb implements Db {
  constructor(private d: RawSqlite) {}
  async all<T>(sql: string, params: Param[] = []) { return this.d.prepare(sql).all(...params).map((r) => norm<T>({ ...r })); }
  async run(sql: string, params: Param[] = []) { return { changes: Number(this.d.prepare(sql).run(...params).changes) }; }
  async batch(stmts: { sql: string; params?: Param[] }[]) {
    // node:sqlite синхронный, поэтому пачка выполняется целиком без вмешательства других запросов
    this.d.exec("BEGIN");
    try {
      const out = stmts.map((s) => ({ changes: Number(this.d.prepare(s.sql).run(...(s.params ?? [])).changes) }));
      this.d.exec("COMMIT");
      return out;
    } catch (e) { this.d.exec("ROLLBACK"); throw e; }
  }
}

export async function createSqlite(file = ":memory:"): Promise<Db> {
  const mod = "node:sqlite";
  const { DatabaseSync } = (await import(/* webpackIgnore: true */ mod)) as { DatabaseSync: new (f: string) => RawSqlite };
  if (file !== ":memory:") mkdirSync(file.replace(/\/[^/]+$/, ""), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec("PRAGMA foreign_keys = ON");
  const exists = (d.prepare("SELECT name FROM sqlite_master WHERE name='tenants'") as { all(): unknown[] }).all().length > 0;
  if (!exists) d.exec(readFileSync("migrations/0001_init.sql", "utf8"));
  // последующие миграции безопасны для повторного запуска (CREATE ... IF NOT EXISTS)
  for (const f of readdirSync("migrations").filter((x) => /^\d+_.*\.sql$/.test(x) && !x.startsWith("0001_")).sort()) d.exec(readFileSync(`migrations/${f}`, "utf8"));
  return new SqliteDb(d);
}

/* ---------- выбор базы ---------- */
const g = globalThis as unknown as { __db?: Promise<Db> };
async function cloudflareDb(): Promise<Db | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const d1 = (ctx.env as unknown as { DB?: D1Like }).DB;
    return d1 ? new D1Db(d1) : null;
  } catch { return null; }
}
export async function getDb(): Promise<Db> {
  const cf = await cloudflareDb();
  if (cf) { await ensureSeed(cf); return cf; }
  if (!g.__db) g.__db = createSqlite(process.env.DATABASE_FILE ?? ".data/app.sqlite").then(async (d) => { await ensureSeed(d); return d; });
  return g.__db;
}
async function ensureSeed(db: Db) {
  const { seedIfEmpty } = await import("./seed");
  await seedIfEmpty(db);
}

export async function rows<T = Record<string, unknown>>(db: Q, sql: string, params: Param[] = []): Promise<T[]> { return db.all<T>(sql, params); }
export async function one<T = Record<string, unknown>>(db: Q, sql: string, params: Param[] = []): Promise<T | null> { return (await db.all<T>(sql, params))[0] ?? null; }
export function auditStmt(tenantId: string | null, actor: string, action: string, target?: string, diff?: unknown) {
  return { sql: "INSERT INTO audit_events(id,tenant_id,actor,action,target,diff,at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [uuid(), tenantId, actor, action, target ?? null, diff ? js(diff) : null, nowIso()] as Param[] };
}
export async function audit(db: Q, tenantId: string | null, actor: string, action: string, target?: string, diff?: unknown) {
  const s = auditStmt(tenantId, actor, action, target, diff);
  await db.run(s.sql, s.params);
}
export const isUnique = (e: unknown) => /UNIQUE constraint failed/i.test(String((e as Error)?.message));
export const isOverlap = (e: unknown) => /slot_overlap/.test(String((e as Error)?.message));
