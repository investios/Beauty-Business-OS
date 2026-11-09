import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { mkdirSync } from "node:fs";
import { SCHEMA } from "./schema";

// PGlite = настоящий PostgreSQL (WASM) без отдельного сервера: для локального прототипа.
// В production тот же SQL работает на управляемом PostgreSQL; меняется только этот файл.
export type Db = PGlite;
type Q = { query: PGlite["query"] };

const g = globalThis as unknown as { __db?: Promise<PGlite> };

export async function createDb(dataDir?: string): Promise<PGlite> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = new PGlite({ ...(dataDir ? { dataDir } : {}), extensions: { btree_gist } });
  await db.waitReady;
  await db.exec(SCHEMA);
  return db;
}

export function getDb(): Promise<PGlite> {
  if (!g.__db) {
    const dir = process.env.DATABASE_DIR === "memory" ? undefined : process.env.DATABASE_DIR ?? ".data/pg";
    g.__db = createDb(dir).then(async (db) => {
      const { seedIfEmpty } = await import("./seed");
      await seedIfEmpty(db);
      return db;
    });
  }
  return g.__db;
}

export async function rows<T = Record<string, unknown>>(db: Q, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await db.query<T>(sql, params);
  return r.rows;
}
export async function one<T = Record<string, unknown>>(db: Q, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await rows<T>(db, sql, params);
  return r[0] ?? null;
}
export async function audit(db: Q, tenantId: string | null, actor: string, action: string, target?: string, diff?: unknown) {
  await db.query("INSERT INTO audit_events(tenant_id,actor,action,target,diff) VALUES ($1,$2,$3,$4,$5)", [tenantId, actor, action, target ?? null, diff ? JSON.stringify(diff) : null]);
}
