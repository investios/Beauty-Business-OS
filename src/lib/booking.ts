import { auditStmt, isOverlap, isUnique, js, nowIso, one, rows, uuid, type Db, type Param } from "./db";
import { addLocalDays, DEFAULT_TZ, formatLocal, localParts, weekdayOfLocalDate, zonedToUtc } from "./tz";


export class BookingError extends Error {
  constructor(public code: "slot_taken" | "slot_unavailable" | "not_found" | "invalid" | "forbidden", message: string, public alternatives: Slot[] = []) {
    super(message);
  }
}

export type Slot = { startUtc: string; endUtc: string; label: string };
export type Service = { id: string; slug: string; title_i18n: Record<string, string>; desc_i18n: Record<string, string>; duration_min: number; buffer_min: number; price_mode: string; price_from_cents: number | null; is_placeholder: boolean };

/** Настройки слотов задаёт мастер в кабинете; если таблицы настроек ещё нет в базе, работают эти значения */
export type ScheduleSettings = { stepMin: number; minNoticeMin: number; horizonDays: number };
export const DEFAULT_SETTINGS: ScheduleSettings = { stepMin: 60, minNoticeMin: 0, horizonDays: 183 };
export type ScheduleException = { id: string; day: string; kind: "closed" | "open"; start_min: number | null; end_min: number | null; note: string | null };
export async function getScheduleSettings(db: Db, tenantId: string): Promise<ScheduleSettings> {
  try {
    const r = await one<{ step_min: number; min_notice_min: number; horizon_days: number }>(db, "SELECT step_min,min_notice_min,horizon_days FROM schedule_settings WHERE tenant_id=?1", [tenantId]);
    return r ? { stepMin: r.step_min, minNoticeMin: r.min_notice_min, horizonDays: r.horizon_days } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
export async function listExceptions(db: Db, tenantId: string, fromDay?: string): Promise<ScheduleException[]> {
  try { return await rows<ScheduleException>(db, "SELECT id,day,kind,start_min,end_min,note FROM schedule_exceptions WHERE tenant_id=?1 AND day >= ?2 ORDER BY day,start_min", [tenantId, fromDay ?? "0000-00-00"]); }
  catch { return []; }
}
const dayKey = (d: { y: number; mo: number; d: number }) => `${d.y}-${String(d.mo).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
const HOLD_MIN = 10;

const token = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const ACTIVE = "('held','confirmed','requested')";

export async function getTenantBySlug(db: Db, slug: string) {
  return one<{ id: string; slug: string; name: string; timezone: string; default_locale: string; is_demo: boolean }>(db, "SELECT id,slug,name,timezone,default_locale,is_demo FROM tenants WHERE slug=?1", [slug]);
}

export async function listServices(db: Db, tenantId: string): Promise<Service[]> {
  return rows<Service>(db, "SELECT id,slug,title_i18n,desc_i18n,duration_min,buffer_min,price_mode,price_from_cents,is_placeholder FROM services WHERE tenant_id=?1 AND active=1 ORDER BY duration_min", [tenantId]);
}

export async function expireHolds(db: Db, now = new Date()) {
  await db.run("UPDATE appointments SET status='cancelled' WHERE status='held' AND hold_expires_at < ?1", [now.toISOString()]);
}

async function staffFor(db: Db, tenantId: string, serviceId: string) {
  return rows<{ id: string }>(db, "SELECT s.id FROM staff s JOIN staff_services ss ON ss.staff_id=s.id WHERE s.tenant_id=?1 AND s.active=1 AND ss.service_id=?2 ORDER BY s.name", [tenantId, serviceId]);
}

/** Реальные свободные окна: рабочие часы (местное время) минус занятые записи, с учётом перехода на летнее/зимнее время. */
export async function getAvailability(db: Db, p: { tenantId: string; serviceId: string; from?: Date; days?: number; staffId?: string; now?: Date; tz?: string; excludeAppointmentId?: string }): Promise<(Slot & { staffId: string })[]> {
  const now = p.now ?? new Date();
  const tz = p.tz ?? DEFAULT_TZ;
  await expireHolds(db, now);
  const svc = await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=?1 AND tenant_id=?2 AND active=1", [p.serviceId, p.tenantId]);
  if (!svc) throw new BookingError("not_found", "service not found");
  let staff = await staffFor(db, p.tenantId, p.serviceId);
  if (p.staffId) staff = staff.filter((s) => s.id === p.staffId);
  const start = p.from ?? now;
  const lp = localParts(start.getTime(), tz);
  const cfg = await getScheduleSettings(db, p.tenantId);
  const days = p.days ?? 14;
  const earliest = now.getTime() + cfg.minNoticeMin * 60000;
  const latest = now.getTime() + cfg.horizonDays * 86400000;
  const exc = await listExceptions(db, p.tenantId, dayKey(lp));
  const out: (Slot & { staffId: string })[] = [];

  for (const st of staff) {
    const rules = await rows<{ weekday: number; start_min: number; end_min: number }>(db, "SELECT weekday,start_min,end_min FROM availability_rules WHERE staff_id=?1 AND tenant_id=?2", [st.id, p.tenantId]);
    const rangeStart = new Date(start.getTime() - 86400000).toISOString();
    const rangeEnd = new Date(start.getTime() + (days + 2) * 86400000).toISOString();
    const busy = await rows<{ s: string; e: string }>(db, `SELECT start_at s, blocked_until e FROM appointments WHERE staff_id=?1 AND status IN ${ACTIVE} AND start_at < ?3 AND blocked_until > ?2 AND (?4 IS NULL OR id <> ?4)`, [st.id, rangeStart, rangeEnd, p.excludeAppointmentId ?? null]);
    const busyMs = busy.map((b) => [new Date(b.s).getTime(), new Date(b.e).getTime()] as const);
    for (let i = 0; i <= days; i++) {
      const day = addLocalDays(lp.y, lp.mo, lp.d, i);
      const wd = weekdayOfLocalDate(day.y, day.mo, day.d);
      const k = dayKey(day);
      const dayExc = exc.filter((e) => e.day === k);
      const closedAll = dayExc.some((e) => e.kind === "closed" && e.start_min == null);
      if (closedAll) continue; // выходной: ни одного слота
      const intervals = [
        ...rules.filter((x) => x.weekday === wd).map((x) => ({ a: x.start_min, b: x.end_min })),
        ...dayExc.filter((e) => e.kind === "open").map((e) => ({ a: e.start_min!, b: e.end_min! })),
      ];
      const closedRanges = dayExc.filter((e) => e.kind === "closed").map((e) => ({ a: e.start_min!, b: e.end_min! }));
      const seen = new Set<number>();
      for (const r of intervals) {
        for (let m = r.a; m + svc.duration_min <= r.b; m += cfg.stepMin) {
          if (seen.has(m)) continue; seen.add(m);
          if (closedRanges.some((c) => m < c.b && m + svc.duration_min > c.a)) continue;
          const z = zonedToUtc(day.y, day.mo, day.d, Math.floor(m / 60), m % 60, tz);
          if (z.status !== "ok") continue; // пропущенный/повторный час: явно не предлагаем
          const s = z.utcMs, e = s + svc.duration_min * 60000, blocked = e + svc.buffer_min * 60000;
          if (s < earliest || s > latest) continue;
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
  /** запись, которую мастер ставит сам: любое время и день, без проверки по рабочим часам (занятость по-прежнему защищена) */
  ownerOverride?: boolean;
  now?: Date;
};
export type BookingResult = { appointmentId: string; status: string; startsAtUtc: string; endsAtUtc: string; timezone: string; manageToken: string; confirmationDeliveryStatus: string; replayed: boolean };
type ApptRow = { id: string; status: string; start_at: string; end_at: string; manage_token: string; confirmation_delivery_status: string };
const APPT_COLS = "id,status,start_at,end_at,manage_token,confirmation_delivery_status";

function shape(r: ApptRow, tz: string, replayed: boolean): BookingResult {
  return { appointmentId: r.id, status: r.status, startsAtUtc: new Date(r.start_at).toISOString(), endsAtUtc: new Date(r.end_at).toISOString(), timezone: tz, manageToken: r.manage_token, confirmationDeliveryStatus: r.confirmation_delivery_status, replayed };
}

type Stmt = { sql: string; params: Param[] };
const reminderStmts = (tenantId: string, apptId: string, start: Date, now: Date): Stmt[] => {
  // Подтверждение и напоминание — только записи в очередь; реальная отправка отдельно и честно помечается.
  const out: Stmt[] = [{ sql: "INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at) VALUES (?1,?2,?3,'booking_confirmation','not_configured',?4,?4)", params: [uuid(), tenantId, apptId, now.toISOString()] }];
  const at = new Date(start.getTime() - 24 * 3600000);
  if (at > now) out.push({ sql: "INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at) VALUES (?1,?2,?3,'reminder_24h','queued',?4,?5)", params: [uuid(), tenantId, apptId, at.toISOString(), now.toISOString()] });
  return out;
};

export async function createBooking(db: Db, input: BookingInput): Promise<BookingResult> {
  if (!input.idempotencyKey || input.idempotencyKey.length < 8) throw new BookingError("invalid", "idempotencyKey required");
  if (!input.client.name.trim() || !validContact(input.client.contact)) throw new BookingError("invalid", "name and a valid email or phone required");
  if (!input.consentService) throw new BookingError("invalid", "consent to process contact data for the booking is required");
  const tz = DEFAULT_TZ;

  const findByKey = () => one<ApptRow>(db, `SELECT ${APPT_COLS} FROM appointments WHERE tenant_id=?1 AND idempotency_key=?2`, [input.tenantId, input.idempotencyKey]);
  // Повтор с тем же ключом → тот же результат, без дубля
  const prev = await findByKey();
  if (prev) return shape(prev, tz, true);

  const now = input.now ?? new Date();
  const start = new Date(input.startsAtUtc);
  if (isNaN(start.getTime())) throw new BookingError("invalid", "bad startsAtUtc");
  await expireHolds(db, now);
  const svc = await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=?1 AND tenant_id=?2 AND active=1", [input.serviceId, input.tenantId]);
  if (!svc) throw new BookingError("not_found", "service not found");

  // Слот обязан быть из реального расчёта доступности (а не придуман клиентом/ИИ)
  const avail = await getAvailability(db, { tenantId: input.tenantId, serviceId: input.serviceId, from: new Date(start.getTime() - 86400000), days: 3, staffId: input.staffId, now, tz });
  const match = avail.find((a) => a.startUtc === start.toISOString());
  let staffId = match?.staffId;
  let hold: { id: string; staff_id: string } | null = null;
  if (input.holdId) {
    hold = await one<{ id: string; staff_id: string }>(db, "SELECT id,staff_id FROM appointments WHERE id=?1 AND tenant_id=?2 AND status='held' AND start_at=?3 AND hold_expires_at >= ?4", [input.holdId, input.tenantId, start.toISOString(), now.toISOString()]);
    if (!hold) throw new BookingError("slot_unavailable", "hold expired or not found");
    staffId = hold.staff_id;
  } else if (input.ownerOverride) {
    staffId = (await staffFor(db, input.tenantId, input.serviceId))[0]?.id;
    if (!staffId) throw new BookingError("not_found", "no staff for service");
  } else if (!match) {
    throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
  }

  const end = new Date(start.getTime() + svc.duration_min * 60000);
  const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
  const norm = normContact(input.client.contact);
  const apptId = hold?.id ?? uuid();
  const clientSel = "(SELECT id FROM clients WHERE tenant_id=?1 AND contact_norm=?2)";
  const upsertClient: Stmt = {
    sql: "INSERT INTO clients(id,tenant_id,name,contact,contact_norm,preferred_locale,created_from,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(tenant_id,contact_norm) DO UPDATE SET preferred_locale=excluded.preferred_locale",
    params: [uuid(), input.tenantId, input.client.name.trim(), input.client.contact.trim(), norm, input.client.locale, js(input.source ?? {}), now.toISOString()],
  };
  const tok = token();
  const consent = (purpose: string): Stmt => ({
    sql: `INSERT INTO consents(id,tenant_id,client_id,purpose,channel,policy_version,granted_at) VALUES (?3,?1,${clientSel},?4,'website','2026-11-draft',?5)`,
    params: [input.tenantId, norm, uuid(), purpose, now.toISOString()],
  });
  const tail: Stmt[] = [consent("service"), ...(input.consentMarketing ? [consent("marketing")] : []), ...reminderStmts(input.tenantId, apptId, start, now), auditStmt(input.tenantId, "guest", "booking.create", apptId) as Stmt];

  try {
    if (hold) {
      // удержание превращаем в запись одним защищённым UPDATE
      const r = await db.batch([upsertClient, {
        sql: `UPDATE appointments SET client_id=${clientSel.replace("?1", "?3").replace("?2", "?4")}, status='confirmed', hold_expires_at=NULL, idempotency_key=?5, manage_token=?6, locale=?7, source=?8 WHERE id=?1 AND tenant_id=?2 AND status='held' AND hold_expires_at >= ?9`,
        params: [apptId, input.tenantId, input.tenantId, norm, input.idempotencyKey, tok, input.client.locale, js(input.source ?? {}), now.toISOString()],
      }]);
      if (r[1].changes !== 1) throw new BookingError("slot_unavailable", "hold expired or not found");
      await db.batch(tail);
    } else {
      await db.batch([upsertClient, {
        sql: `INSERT INTO appointments(id,tenant_id,client_id,staff_id,service_id,start_at,end_at,blocked_until,status,idempotency_key,manage_token,locale,source,created_at)
          VALUES (?1,?2,(SELECT id FROM clients WHERE tenant_id=?2 AND contact_norm=?3),?4,?5,?6,?7,?8,'confirmed',?9,?10,?11,?12,?13)`,
        params: [apptId, input.tenantId, norm, staffId!, input.serviceId, start.toISOString(), end.toISOString(), blocked.toISOString(), input.idempotencyKey, tok, input.client.locale, js(input.source ?? {}), now.toISOString()],
      }, ...tail]);
    }
  } catch (e) {
    if (e instanceof BookingError) throw e;
    if (isOverlap(e)) {
      // параллельный повтор того же запроса: его бронь уже создана, отдаём её, а не ошибку
      const again = await findByKey();
      if (again) return shape(again, tz, true);
      const alt = await getAvailability(db, { tenantId: input.tenantId, serviceId: input.serviceId, from: start, days: 7, now }).catch(() => []);
      throw new BookingError("slot_taken", "This time was just taken", alt.slice(0, 5));
    }
    if (isUnique(e)) { const again = await findByKey(); if (again) return shape(again, tz, true); }
    throw e;
  }
  return shape((await one<ApptRow>(db, `SELECT ${APPT_COLS} FROM appointments WHERE id=?1`, [apptId]))!, tz, false);
}

/** Гостевой доступ только по неугадываемому токену ссылки управления записью. */
export async function getBookingByToken(db: Db, tenantId: string, id: string, tokenStr: string) {
  return one<{ id: string; status: string; start_at: string; end_at: string; service_id: string }>(db, "SELECT id,status,start_at,end_at,service_id FROM appointments WHERE id=?1 AND tenant_id=?2 AND manage_token=?3", [id, tenantId, tokenStr]);
}

export async function cancelBooking(db: Db, tenantId: string, id: string, tokenStr: string) {
  const a = await getBookingByToken(db, tenantId, id, tokenStr);
  if (!a) throw new BookingError("not_found", "booking not found");
  if (a.status === "cancelled") return { status: "cancelled" };
  await db.batch([
    { sql: "UPDATE appointments SET status='cancelled', version=version+1 WHERE id=?1 AND tenant_id=?2", params: [id, tenantId] },
    { sql: "UPDATE notifications SET status='cancelled' WHERE appointment_id=?1 AND status='queued'", params: [id] },
    auditStmt(tenantId, "guest", "booking.cancel", id) as Stmt,
  ]);
  return { status: "cancelled" };
}

export async function rescheduleBooking(db: Db, p: { tenantId: string; id: string; token: string; newStartUtc: string; now?: Date }) {
  const now = p.now ?? new Date();
  const a = await one<{ id: string; status: string; service_id: string; staff_id: string }>(db, "SELECT id,status,service_id,staff_id FROM appointments WHERE id=?1 AND tenant_id=?2 AND manage_token=?3", [p.id, p.tenantId, p.token]);
  if (!a || a.status !== "confirmed") throw new BookingError("not_found", "booking not found");
  const start = new Date(p.newStartUtc);
  // своё текущее окно считаем свободным, чужие занятые — нет
  const avail = await getAvailability(db, { tenantId: p.tenantId, serviceId: a.service_id, from: new Date(start.getTime() - 86400000), days: 3, now, staffId: a.staff_id, excludeAppointmentId: a.id });
  if (!avail.find((s) => s.startUtc === start.toISOString())) throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
  const svc = (await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=?1", [a.service_id]))!;
  const end = new Date(start.getTime() + svc.duration_min * 60000);
  const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
  try {
    await db.batch([
      { sql: "UPDATE appointments SET start_at=?1,end_at=?2,blocked_until=?3,version=version+1 WHERE id=?4 AND tenant_id=?5 AND status='confirmed'", params: [start.toISOString(), end.toISOString(), blocked.toISOString(), a.id, p.tenantId] },
      // Старые напоминания гасим, новое создаём ровно одно — дублей нет
      { sql: "UPDATE notifications SET status='cancelled' WHERE appointment_id=?1 AND status='queued'", params: [a.id] },
      ...(new Date(start.getTime() - 24 * 3600000) > now ? [{ sql: "INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at) VALUES (?1,?2,?3,'reminder_24h','queued',?4,?5)", params: [uuid(), p.tenantId, a.id, new Date(start.getTime() - 24 * 3600000).toISOString(), now.toISOString()] as Param[] }] : []),
      auditStmt(p.tenantId, "guest", "booking.reschedule", a.id) as Stmt,
    ]);
  } catch (e) {
    if (isOverlap(e)) throw new BookingError("slot_taken", "This time was just taken");
    throw e;
  }
  return { status: "confirmed", startsAtUtc: start.toISOString() };
}

export async function createHold(db: Db, p: { tenantId: string; serviceId: string; startsAtUtc: string; now?: Date }) {
  const now = p.now ?? new Date();
  const start = new Date(p.startsAtUtc);
  const avail = await getAvailability(db, { tenantId: p.tenantId, serviceId: p.serviceId, from: new Date(start.getTime() - 86400000), days: 3, now });
  const m = avail.find((a) => a.startUtc === start.toISOString());
  if (!m) throw new BookingError("slot_unavailable", "This time is not available", avail.slice(0, 5));
  const svc = (await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=?1", [p.serviceId]))!;
  const end = new Date(start.getTime() + svc.duration_min * 60000);
  const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
  const exp = new Date(now.getTime() + HOLD_MIN * 60000);
  const id = uuid();
  try {
    await db.run(`INSERT INTO appointments(id,tenant_id,staff_id,service_id,start_at,end_at,blocked_until,status,hold_expires_at,idempotency_key,manage_token,created_at)
      VALUES (?1,?2,?3,?4,?5,?6,?7,'held',?8,?9,?10,?11)`, [id, p.tenantId, m.staffId, p.serviceId, start.toISOString(), end.toISOString(), blocked.toISOString(), exp.toISOString(), "hold-" + uuid(), token(), now.toISOString()]);
  } catch (e) {
    if (isOverlap(e)) throw new BookingError("slot_taken", "This time was just taken");
    throw e;
  }
  return { holdId: id, expiresAt: exp.toISOString() };
}

/* ---------- действия мастера над записями (кабинет): те же таблицы и защита от двойной записи ---------- */
export type OwnerStatus = "confirmed" | "completed" | "no_show";
export async function ownerSetStatus(db: Db, p: { tenantId: string; id: string; status: OwnerStatus }) {
  const from = p.status === "confirmed" ? "('requested')" : "('confirmed')";
  const r = await db.run(`UPDATE appointments SET status=?1, version=version+1 WHERE id=?2 AND tenant_id=?3 AND status IN ${from}`, [p.status, p.id, p.tenantId]);
  if (r.changes !== 1) throw new BookingError("not_found", "appointment not found or status cannot be changed");
  const au = auditStmt(p.tenantId, "owner", "booking." + p.status, p.id) as Stmt;
  await db.run(au.sql, au.params);
  return { status: p.status };
}
export async function ownerCancelBooking(db: Db, tenantId: string, id: string) {
  const a = await one<{ status: string }>(db, "SELECT status FROM appointments WHERE id=?1 AND tenant_id=?2", [id, tenantId]);
  if (!a) throw new BookingError("not_found", "booking not found");
  if (a.status === "cancelled") return { status: "cancelled" };
  await db.batch([
    { sql: "UPDATE appointments SET status='cancelled', version=version+1 WHERE id=?1 AND tenant_id=?2 AND status IN ('requested','confirmed','held')", params: [id, tenantId] },
    { sql: "UPDATE notifications SET status='cancelled' WHERE appointment_id=?1 AND status='queued'", params: [id] },
    auditStmt(tenantId, "owner", "booking.cancel", id) as Stmt,
  ]);
  return { status: "cancelled" };
}
/** Мастер переносит запись на любое время: рабочие часы не проверяются, пересечение с другой записью по-прежнему невозможно */
export async function ownerRescheduleBooking(db: Db, p: { tenantId: string; id: string; newStartUtc: string; now?: Date }) {
  const now = p.now ?? new Date();
  const a = await one<{ id: string; status: string; service_id: string }>(db, "SELECT id,status,service_id FROM appointments WHERE id=?1 AND tenant_id=?2", [p.id, p.tenantId]);
  if (!a || !["confirmed", "requested"].includes(a.status)) throw new BookingError("not_found", "booking not found");
  const start = new Date(p.newStartUtc);
  if (isNaN(start.getTime())) throw new BookingError("invalid", "bad start");
  const svc = (await one<{ duration_min: number; buffer_min: number }>(db, "SELECT duration_min,buffer_min FROM services WHERE id=?1", [a.service_id]))!;
  const end = new Date(start.getTime() + svc.duration_min * 60000);
  const blocked = new Date(end.getTime() + svc.buffer_min * 60000);
  try {
    await db.batch([
      { sql: "UPDATE appointments SET start_at=?1,end_at=?2,blocked_until=?3,version=version+1 WHERE id=?4 AND tenant_id=?5 AND status IN ('confirmed','requested')", params: [start.toISOString(), end.toISOString(), blocked.toISOString(), a.id, p.tenantId] },
      { sql: "UPDATE notifications SET status='cancelled' WHERE appointment_id=?1 AND status='queued'", params: [a.id] },
      ...(new Date(start.getTime() - 24 * 3600000) > now ? [{ sql: "INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at) VALUES (?1,?2,?3,'reminder_24h','queued',?4,?5)", params: [uuid(), p.tenantId, a.id, new Date(start.getTime() - 24 * 3600000).toISOString(), now.toISOString()] }] : []),
      auditStmt(p.tenantId, "owner", "booking.reschedule", a.id) as Stmt,
    ]);
  } catch (e) {
    if (isOverlap(e)) throw new BookingError("slot_taken", "This time is taken by another appointment");
    throw e;
  }
  return { status: "confirmed", startsAtUtc: start.toISOString() };
}
