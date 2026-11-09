import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, one } from "@/lib/db";
import { BookingError, cancelBooking, createBooking, getAvailability, getBookingByToken, getTenantBySlug, listServices, rescheduleBooking } from "@/lib/booking";
import { handleMessage, startConversation } from "@/lib/ai";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { formatLocal } from "@/lib/tz";

type Ctx = { params: Promise<{ tenant: string; path: string[] }> };
const loc = z.enum(["en", "ru", "uk"]);
const source = z.record(z.string().max(100), z.string().max(200)).optional();

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const err = (status: number, code: string, message: string, extra: object = {}) => json({ error: { code, message, ...extra } }, status);

function bookingErr(e: unknown) {
  if (e instanceof BookingError) {
    const status = e.code === "slot_taken" ? 409 : e.code === "slot_unavailable" ? 409 : e.code === "not_found" ? 404 : 400;
    return err(status, e.code, e.message, { alternatives: e.alternatives });
  }
  console.error("booking api error", e instanceof Error ? e.message : e);
  return err(500, "internal", "Internal error");
}

async function route(req: Request, ctx: Ctx, method: "GET" | "POST") {
  const { tenant: slug, path } = await ctx.params;
  const ip = clientIp(req);
  if (!rateLimit(`pub:${ip}`, 120, 60_000)) return err(429, "rate_limited", "Too many requests");
  const db = await getDb();
  const tenant = await getTenantBySlug(db, slug);
  if (!tenant) return err(404, "not_found", "Unknown studio");
  const url = new URL(req.url);
  const seg = path.join("/");

  try {
    if (method === "GET" && seg === "services") {
      return json({ services: await listServices(db, tenant.id), demo: tenant.is_demo });
    }
    if (method === "GET" && seg === "availability") {
      const serviceId = z.string().uuid().parse(url.searchParams.get("serviceId"));
      const days = Math.min(Number(url.searchParams.get("days") ?? 28) || 28, 60);
      const locale = loc.catch("en").parse(url.searchParams.get("locale"));
      const slots = await getAvailability(db, { tenantId: tenant.id, serviceId, days });
      return json({ timezone: tenant.timezone, slots: slots.map((s) => ({ startUtc: s.startUtc, endUtc: s.endUtc, label: formatLocal(new Date(s.startUtc).getTime(), locale) })) });
    }
    if (method === "POST" && seg === "bookings") {
      if (!rateLimit(`book:${ip}`, 10, 60_000)) return err(429, "rate_limited", "Too many requests");
      const body = z.object({
        serviceId: z.string().uuid(), startsAtUtc: z.string().datetime(), idempotencyKey: z.string().min(8).max(100),
        client: z.object({ name: z.string().min(1).max(100), contact: z.string().min(5).max(120), locale: loc }),
        consentService: z.boolean(), consentMarketing: z.boolean().optional(), source,
      }).parse(await req.json());
      const r = await createBooking(db, { tenantId: tenant.id, ...body });
      return json(r, r.replayed ? 200 : 201);
    }
    const m = seg.match(/^bookings\/([0-9a-f-]{36})(?:\/(cancel|reschedule))?$/);
    if (m) {
      const id = m[1];
      const token = url.searchParams.get("token") ?? "";
      if (!rateLimit(`manage:${ip}`, 30, 60_000)) return err(429, "rate_limited", "Too many requests");
      if (method === "GET" && !m[2]) {
        const a = await getBookingByToken(db, tenant.id, id, token);
        if (!a) return err(404, "not_found", "Booking not found");
        const svc = await one<{ title_i18n: Record<string, string>; duration_min: number }>(db, "SELECT title_i18n,duration_min FROM services WHERE id=?1", [a.service_id]);
        return json({ id: a.id, status: a.status, startsAtUtc: new Date(a.start_at).toISOString(), endsAtUtc: new Date(a.end_at).toISOString(), serviceId: a.service_id, service: svc?.title_i18n, timezone: tenant.timezone });
      }
      if (method === "POST" && m[2] === "cancel") return json(await cancelBooking(db, tenant.id, id, token));
      if (method === "POST" && m[2] === "reschedule") {
        const b = z.object({ startsAtUtc: z.string().datetime() }).parse(await req.json());
        return json(await rescheduleBooking(db, { tenantId: tenant.id, id, token, newStartUtc: b.startsAtUtc }));
      }
    }
    if (method === "POST" && seg === "ai/conversations") {
      if (!rateLimit(`aiconv:${ip}`, 10, 60_000)) return err(429, "rate_limited", "Too many requests");
      const b = z.object({ locale: loc, source }).parse(await req.json());
      return json(await startConversation(db, { tenantId: tenant.id, locale: b.locale, source: b.source }), 201);
    }
    const am = seg.match(/^ai\/conversations\/([0-9a-f-]{36})\/messages$/);
    if (method === "POST" && am) {
      if (!rateLimit(`ai:${ip}`, 20, 60_000)) return err(429, "rate_limited", "Too many requests");
      const b = z.object({ text: z.string().min(1).max(1000), locale: loc }).parse(await req.json());
      return json(await handleMessage(db, { tenantId: tenant.id, conversationId: am[1], text: b.text, localeHint: b.locale }));
    }
    return err(404, "not_found", "Not found");
  } catch (e) {
    if (e instanceof z.ZodError) return err(400, "invalid", "Invalid request", { issues: e.issues.map((i) => i.path.join(".")) });
    if (e instanceof SyntaxError) return err(400, "invalid", "Invalid JSON");
    return bookingErr(e);
  }
}
export const GET = (req: Request, ctx: Ctx) => route(req, ctx, "GET");
export const POST = (req: Request, ctx: Ctx) => route(req, ctx, "POST");
