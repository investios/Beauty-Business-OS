import type { PGlite } from "@electric-sql/pglite";
import { randomBytes } from "node:crypto";
import { audit, one, rows } from "./db";
import { addLocalDays, DEFAULT_TZ, formatLocal, localParts, weekdayOfLocalDate, zonedToUtc } from "./tz";

type Q = Pick<PGlite, "query">;
type Tx = Q;

export class BookingError extends Error {
  constructor(public code: "slot_taken" | "slot_unavailable" | "not_found" | "invalid" | "forbidden", message: string, public alternatives: Slot[] = []) {
    super(message);
  }
}

export type Slot = { startUtc: string; endUtc: string; label: string };
export type Service = { id: string; slug: string; title_i18n: Record<string, string>; desc_i18n: Record<string, string>; duration_min: number; buffer_min: number; price_mode: string; price_from_cents: number | null; is_placeholder: boolean };

const STEP_MIN = 30;
const MIN_NOTICE_MIN = 120; // заглушка: не раньше чем через 2 часа (подтвердить у мастера)
const HOLD_MIN = 10;

export async function getTenantBySlug(db: Q, slug: string) {
  return one<{ id: string; slug: string; name: string; timezone: string; default_locale: string; is_demo: boolean }>(db, "SELECT id,slug,name,timezone,default_locale,is_demo FROM tenants WHERE slug=$1", [slug]);
}

export async function listServices(db: Q, tenantId: string): Promise<Service[]> {
  return rows<Service>(db, "SELECT id,slug,title_i18n,desc_i18n,duration_min,buffer_min,price_mode,price_from_cents,is_placeholder FROM services WHERE tenant_id=$1 AND active ORDER BY duration_min", [tenantId]);
}

export async function expireHolds(db: Q, now = new Date()) {
  await db.query("UPDATE appointments SET status='cancelled' WHERE status='held' AND hold_expires_at < $1", [now.toISOString()]);
}

async function staffFor(db: Q, tenantId: string, serviceId: string) {
  return rows<{ id: string }>(db, `SELECT s.id FROM staff s JOIN staff_services ss ON ss.staff_id=s.id WHERE s.tenant_id=$1 AND s.active AND ss.service_id=$2 ORDER BY s.name`, [tenantId, serviceId]);
}

/** Реальные свободные окна: рабочие часы (местное время) минус занятые записи, с учётом перехода на летнее/зимнее время. */
export async function getAvailability(db: Q, p: { tenantId: string; serviceId: string; from?: Date; days?: number; staffId?: string; now?: Date; tz?: string }): Promise<(Slot & { staffId: string })[]> {
  const now = p.now ?? new Date();
  const tz = p.tz ?? DEFAULT_TZ;
  await expireHolds(db, now);
  const svc = await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=$1 AND tenant_id=$2 AND active", [p.serviceId, p.tenantId]);
  if (!svc) throw new BookingError("not_found", "service not found");
  let staff = await staffFor(db, p.tenantId, p.serviceId);
  if (p.staffId) staff = staff.filter((s) => s.id === p.staffId);
  const start = p.from ?? now;
  const lp = localParts(start.getTime(), tz);
  const days = p.days ?? 14;
  const earliest = now.getTime() + MIN_NOTICE_MIN * 60000;
  const out: (Slot & { staffId: string })[] = [];

  for (const st of staff) {
    const rules = await rows<{ weekday: number; start_min: number; end_min: number }>(db, "SELECT weekday,start_min,end_min FROM availability_rules WHERE staff_id=$1 AND tenant_id=$2", [st.id, p.tenantId]);
    const lastDay = addLocalDays(lp.y, lp.mo, lp.d, days);
    const rangeStart = new Date(start.getTime() - 86400000).toISOString();
    const rangeEnd = new Date(start.getTime() + (days + 2) * 86400000).toISOString();
    const busy = await rows<{ s: string; e: string }>(db, "SELECT start_at s, blocked_until e FROM appointments WHERE staff_id=$1 AND status IN ('held','confirmed','requested') AND start_at < $3 AND blocked_until > $2", [st.id, rangeStart, rangeEnd]);
    const busyMs = busy.map((b) => [new Date(b.s).getTime(), new Date(b.e).getTime()] as const);
    void lastDay;
    for (let i = 0; i <= days; i++) {
      const day = addLocalDays(lp.y, lp.mo, lp.d, i);
      const wd = weekdayOfLocalDate(day.y, day.mo, day.d);
      for (const r of rules.filter((x) => x.weekday === wd)) {
        for (let m = r.start_min; m + svc.duration_min <= r.end_min; m += STEP_MIN) {
          const z = zonedToUtc(day.y, day.mo, day.d, Math.floor(m / 60), m % 60, tz);
          if (z.status !== "ok") continue; // пропущенный/повторный час: явно не предлагаем
          const s = z.utcMs, e = s + svc.duration_min * 60000, blocked = e + svc.buffer_min * 60000;
          if (s < earliest) continue;
          if (busyMs.some(([bs, be]) => s < be && blocked > bs)) continue;
          out.push({ staffId: st.id, startUtc: new Date(s).toISOString(), endUtc: new Date(e).toISOString(), label: formatLocal(s, "en", tz) });
        }
      }
    }
  }
  return out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

function normContact(c: string) {
  const t = c.trim();
  if (t.includes("@")) return t.toLowerCase();
  return t.replace(/[^\d+]/g, "");
}
function validContact(c: string) {
  const t = c.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) || /^\+?\d[\d\s()-]{6,18}$/.test(t);
}

export type BookingInput = {
  tenantId: string; serviceId: string; startsAtUtc: string; staffId?: string; holdId?: string;
  client: { name: string; contact: string; locale: string };
  idempotencyKey: string; consentService: boolean; consentMarketing?: boolean; source?: Record<string, string>;
  now?: Date;
};
export type BookingResult = { appointmentId: string; status: string; startsAtUtc: string; endsAtUtc: string; timezone: string; manageToken: string; confirmationDeliveryStatus: string; replayed: boolean };

function pgCode(e: unknown): string | undefined { return (e as { code?: string })?.code; }

export async function createBooking(db: PGlite, input: BookingInput): Promise<BookingResult> {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) throw new BookingError("invalid", "idempotencyKey required");
  if (!input.client.name.trim() || !validContact(input.client.contact)) throw new BookingError("invalid", "name and a valid email or phone required");
  if (!input.consentService) throw new BookingError("invalid", "consent to process contact data for the booking is required");
  const tz = DEFAULT_TZ;

  // Повтор с тем же ключом → тот же результат, без дубля
  const prev = await one<{ id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string }>(db, "SELECT id,status,start_at,end_at,manage_token,confirmation_delivery_status FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2", [input.tenantId, input.idempotencyKey]);
  if (prev) return shape(prev, tz, true);

  const now = input.now ?? new Date();
  const start = new Date(input.startsAtUtc);
  if (isNaN(start.getTime())) throw new BookingError("invalid", "bad startsAtUtc");

  try {
    return await db.transaction(async (tx) => {
      // Повторная проверка ключа уже внутри транзакции: параллельный дубль запроса получает тот же результат
      const dup = await one<{ id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string }>(tx, "SELECT id,status,start_at,end_at,manage_token,confirmation_delivery_status FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2", [input.tenantId, input.idempotencyKey]);
      if (dup) return shape(dup, tz, true);
      await expireHolds(tx, now);
      const svc = await one<{ duration_min: number; buffer_min: number }>(tx, "SELECT duration_min,buffer_min FROM services WHERE id=$1 AND tenant_id=$2 AND active", [input.serviceId, input.tenantId]);
      if (!svc) throw new BookingError("not_found", "service not found");

      // Слот обязан быть из реального расчёта доступности (а не придуман клиентом/ИИ)
      const day = new Date(start.getTime() - 86400000);
      const avail = await getAvailability(tx, { tenantId: input.tenantId, serviceId: input.serviceId, from: day, days: 3, staffId: input.staffId, now, tz });
      const match = avail.find((a) => a.startUtc === start.toISOString());
      let staffId = match?.staffId;
      let holdRow: { id: string } | null = null;
      if (input.holdId) {
        holdRow = await one<{ id: string; staff_id: string }>(tx, "SELECT id,staff_id FROM appointments WHERE id=$1 AND tenant_id=$2 AND status='held' AND start_at=$3", [input.holdId, input.tenantId, start.toISOString()]);
        if (!holdRow) throw new BookingError("slot_unavailable", "hold expired or not found");
        staffId = (holdRow as unknown as { staff_id: string }).staff_id;
      } else if (!match) {
        throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
      }

      const end = new Date(start.getTime() + svc.duration_min * 60000);
      const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
      const norm = normContact(input.client.contact);
      const client = await one<{ id: string }>(tx, `INSERT INTO clients(tenant_id,name,contact,contact_norm,preferred_locale,created_from) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (tenant_id,contact_norm) DO UPDATE SET preferred_locale=EXCLUDED.preferred_locale RETURNING id`,
        [input.tenantId, input.client.name.trim(), input.client.contact.trim(), norm, input.client.locale, JSON.stringify(input.source ?? {})]);
      const token = randomBytes(24).toString("base64url");
      let appt: { id: string };
      if (holdRow) {
        appt = (await one<{ id: string }>(tx, "UPDATE appointments SET client_id=$1,status='confirmed',hold_expires_at=NULL,idempotency_key=$2,manage_token=$3,locale=$4,source=$5 WHERE id=$6 RETURNING id", [client!.id, input.idempotencyKey, token, input.client.locale, JSON.stringify(input.source ?? {}), holdRow.id]))!;
      } else {
        appt = (await one<{ id: string }>(tx, `INSERT INTO appointments(tenant_id,client_id,staff_id,service_id,start_at,end_at,blocked_until,status,idempotency_key,manage_token,locale,source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8,$9,$10,$11) RETURNING id`,
          [input.tenantId, client!.id, staffId, input.serviceId, start.toISOString(), end.toISOString(), blocked.toISOString(), input.idempotencyKey, token, input.client.locale, JSON.stringify(input.source ?? {})]))!;
      }
      await tx.query("INSERT INTO consents(tenant_id,client_id,purpose,channel,policy_version) VALUES ($1,$2,'service','website','2026-11-draft')", [input.tenantId, client!.id]);
      if (input.consentMarketing) await tx.query("INSERT INTO consents(tenant_id,client_id,purpose,channel,policy_version) VALUES ($1,$2,'marketing','website','2026-11-draft')", [input.tenantId, client!.id]);
      await scheduleReminders(tx, input.tenantId, appt.id, start, now);
      await audit(tx, input.tenantId, "guest", "booking.create", appt.id);
      const row = (await one<{ id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string }>(tx, "SELECT id,status,start_at,end_at,manage_token,confirmation_delivery_status FROM appointments WHERE id=$1", [appt.id]))!;
      return shape(row, tz, false);
    });
  } catch (e) {
    if (e instanceof BookingError) throw e;
    if (pgCode(e) === "23P01") {
      const alt = await getAvailability(db, { tenantId: input.tenantId, serviceId: input.serviceId, from: start, days: 7, now }).catch(() => []);
      throw new BookingError("slot_taken", "This time was just taken", alt.slice(0, 5));
    }
    if (pgCode(e) === "23505") {
      const again = await one<{ id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string }>(db, "SELECT id,status,start_at,end_at,manage_token,confirmation_delivery_status FROM appointments WHERE tenant_id=$1 AND idempotency_key=$2", [input.tenantId, input.idempotencyKey]);
      if (again) return shape(again, tz, true);
    }
    throw e;
  }
}

function shape(r: { id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string }, tz: string, replayed: boolean): BookingResult {
  return { appointmentId: r.id, status: r.status, startsAtUtc: new Date(r.start_at).toISOString(), endsAtUtc: new Date(r.end_at).toISOString(), timezone: tz, manageToken: r.manage_token, confirmationDeliveryStatus: r.confirmation_delivery_status, replayed };
}

/** Подтверждение и напоминание — только записи в очередь; реальная отправка отдельно и честно помечается. */
async function scheduleReminders(tx: Tx, tenantId: string, appointmentId: string, start: Date, now: Date) {
  await tx.query("INSERT INTO notifications(tenant_id,appointment_id,kind,status) VALUES ($1,$2,'booking_confirmation','not_configured')", [tenantId, appointmentId]);
  const at = new Date(start.getTime() - 24 * 3600000);
  if (at > now) await tx.query("INSERT INTO notifications(tenant_id,appointment_id,kind,status,scheduled_for) VALUES ($1,$2,'reminder_24h','queued',$3)", [tenantId, appointmentId, at.toISOString()]);
}

/** Гостевой доступ только по неугадываемому токену ссылки управления записью. */
export async function getBookingByToken(db: Q, tenantId: string, id: string, token: string) {
  return one<{ id: string; status: string; start_at: string; end_at: string; service_id: string }>(db, "SELECT id,status,start_at,end_at,service_id FROM appointments WHERE id=$1 AND tenant_id=$2 AND manage_token=$3", [id, tenantId, token]);
}

export async function cancelBooking(db: PGlite, tenantId: string, id: string, token: string) {
  return db.transaction(async (tx) => {
    const a = await getBookingByToken(tx, tenantId, id, token);
    if (!a) throw new BookingError("not_found", "booking not found");
    if (a.status === "cancelled") return { status: "cancelled" };
    await tx.query("UPDATE appointments SET status='cancelled', version=version+1 WHERE id=$1", [id]);
    await tx.query("UPDATE notifications SET status='cancelled' WHERE appointment_id=$1 AND status='queued'", [id]);
    await audit(tx, tenantId, "guest", "booking.cancel", id);
    return { status: "cancelled" };
  });
}

export async function rescheduleBooking(db: PGlite, p: { tenantId: string; id: string; token: string; newStartUtc: string; now?: Date }) {
  const now = p.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const a = await one<{ id: string; status: string; service_id: string; staff_id: string }>(tx, "SELECT id,status,service_id,staff_id FROM appointments WHERE id=$1 AND tenant_id=$2 AND manage_token=$3", [p.id, p.tenantId, p.token]);
      if (!a || a.status !== "confirmed") throw new BookingError("not_found", "booking not found");
      const start = new Date(p.newStartUtc);
      // Освобождаем старое окно в расчёте доступности (исключаем собственную запись из занятых)
      await tx.query("UPDATE appointments SET status='cancelled' WHERE id=$1", [a.id]);
      const avail = await getAvailability(tx, { tenantId: p.tenantId, serviceId: a.service_id, from: new Date(start.getTime() - 86400000), days: 3, now, staffId: a.staff_id });
      if (!avail.find((s) => s.startUtc === start.toISOString())) throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
      const svc = (await one<{ duration_min: number; buffer_min: number }>(tx, "SELECT duration_min,buffer_min FROM services WHERE id=$1", [a.service_id]))!;
      const end = new Date(start.getTime() + svc.duration_min * 60000);
      const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
      await tx.query("UPDATE appointments SET status='confirmed', start_at=$1,end_at=$2,blocked_until=$3,version=version+1 WHERE id=$4", [start.toISOString(), end.toISOString(), blocked.toISOString(), a.id]);
      // Старые напоминания гасим, новые создаём ровно одно — дублей нет
      await tx.query("UPDATE notifications SET status='cancelled' WHERE appointment_id=$1 AND status='queued'", [a.id]);
      const at = new Date(start.getTime() - 24 * 3600000);
      if (at > now) await tx.query("INSERT INTO notifications(tenant_id,appointment_id,kind,status,scheduled_for) VALUES ($1,$2,'reminder_24h','queued',$3)", [p.tenantId, a.id, at.toISOString()]);
      await audit(tx, p.tenantId, "guest", "booking.reschedule", a.id);
      return { status: "confirmed", startsAtUtc: start.toISOString() };
    });
  } catch (e) {
    if (pgCode(e) === "23P01") throw new BookingError("slot_taken", "This time was just taken");
    throw e;
  }
}

export async function createHold(db: PGlite, p: { tenantId: string; serviceId: string; startsAtUtc: string; now?: Date }) {
  const now = p.now ?? new Date();
  const start = new Date(p.startsAtUtc);
  try {
    return await db.transaction(async (tx) => {
      const avail = await getAvailability(tx, { tenantId: p.tenantId, serviceId: p.serviceId, from: new Date(start.getTime() - 86400000), days: 3, now });
      const m = avail.find((a) => a.startUtc === start.toISOString());
      if (!m) throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
      const svc = (await one<{ duration_min: number; buffer_min: number }>(tx, "SELECT duration_min,buffer_min FROM services WHERE id=$1", [p.serviceId]))!;
      const end = new Date(start.getTime() + svc.duration_min * 60000);
      const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
      const exp = new Date(now.getTime() + HOLD_MIN * 60000);
      const r = await one<{ id: string }>(tx, `INSERT INTO appointments(tenant_id,staff_id,service_id,start_at,end_at,blocked_until,status,hold_expires_at,idempotency_key,manage_token)
        VALUES ($1,$2,$3,$4,$5,$6,'held',$7,$8,$9) RETURNING id`, [p.tenantId, m.staffId, p.serviceId, start.toISOString(), end.toISOString(), blocked.toISOString(), exp.toISOString(), "hold-" + randomBytes(9).toString("hex"), randomBytes(24).toString("base64url")]);
      return { holdId: r!.id, expiresAt: exp.toISOString() };
    });
  } catch (e) {
    if (pgCode(e) === "23P01") throw new BookingError("slot_taken", "This time was just taken");
    throw e;
  }
}
