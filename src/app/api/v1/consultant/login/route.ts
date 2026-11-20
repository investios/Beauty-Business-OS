import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, one, audit } from "@/lib/db";
import { consultantPassword, makeConsultantSession, safeEqual, CONSULTANT_COOKIE, SESSION_TTL_S } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { clearLoginFailures, loginAllowed, recordLoginFailure } from "@/lib/login-throttle";

export async function POST(req: Request) {
  const pw = consultantPassword();
  if (!pw) return NextResponse.json({ error: "Not found" }, { status: 404 }); // вход консультанта выключен, пока не задан пароль
  const ip = clientIp(req);
  if (!rateLimit(`clogin:${ip}`, 5, 15 * 60_000)) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const db = await getDb();
  if (!(await loginAllowed(db, ip))) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success || !safeEqual(parsed.data.password, pw)) { await recordLoginFailure(db, ip); return NextResponse.json({ error: "Wrong password" }, { status: 401 }); }
  await clearLoginFailures(db, ip);
  const t = await one<{ id: string }>(db, "SELECT id FROM tenants ORDER BY created_at, rowid LIMIT 1");
  await audit(db, t!.id, "consultant", "login");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONSULTANT_COOKIE, makeConsultantSession(t!.id), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_TTL_S });
  return res;
}
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CONSULTANT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
