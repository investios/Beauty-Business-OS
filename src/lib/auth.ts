import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { one } from "./db";
import { getDb } from "./db";

const COOKIE = "owner_session";
const TTL_MS = 12 * 3600 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET (>=16 chars) is required in production");
  return "dev-only-secret-change-me-0000";
}
export function ownerPassword(): string {
  const p = process.env.OWNER_PASSWORD;
  if (p) return p;
  if (process.env.NODE_ENV === "production") throw new Error("OWNER_PASSWORD is required in production");
  return "demo-owner";
}
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function makeSession(tenantId: string): string {
  const body = Buffer.from(JSON.stringify({ t: tenantId, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function readSession(token: string | undefined): { tenantId: string } | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, sign(body))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof p.t !== "string" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return { tenantId: p.t };
  } catch { return null; }
}
export const SESSION_COOKIE = COOKIE;
export const SESSION_TTL_S = TTL_MS / 1000;

/** Для страниц кабинета: возвращает салон владельца или null. Все запросы кабинета фильтруются по этому tenantId. */
export async function ownerTenant() {
  const jar = await cookies();
  const s = readSession(jar.get(COOKIE)?.value);
  if (!s) return null;
  const db = await getDb();
  return one<{ id: string; name: string; slug: string; is_demo: boolean }>(db, "SELECT id,name,slug,is_demo FROM tenants WHERE id=$1", [s.tenantId]);
}
