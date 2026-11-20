import { getDb } from "@/lib/db";
import { tickAllTenants } from "@/lib/jobs";
export const dynamic = "force-dynamic";

/** Вызывается внешним расписанием (Cloudflare Cron / любой планировщик) раз в 15 минут.
 *  Защита: заголовок Authorization: Bearer <CRON_SECRET>. Пока секрет не задан, адрес отвечает 404. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  let diff = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  if (diff !== 0) return new Response("Unauthorized", { status: 401 });
  const r = await tickAllTenants(await getDb());
  return Response.json(r);
}
