"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookingError, createBooking, ownerCancelBooking, ownerRescheduleBooking, ownerSetStatus, type OwnerStatus } from "@/lib/booking";
import { zonedToUtc } from "@/lib/tz";
import { ownerTenant } from "@/lib/auth";
import { audit, getDb, nowIso } from "@/lib/db";
import { publishKnowledge } from "@/lib/seed";

async function guard() {
  const t = await ownerTenant();
  if (!t) throw new Error("unauthorized");
  return { tenantId: t.id, db: await getDb() };
}

export async function toggleAutomation(fd: FormData) {
  const { tenantId, db } = await guard();
  const key = String(fd.get("key"));
  await db.run("UPDATE automations SET enabled = 1 - enabled WHERE tenant_id=?1 AND key=?2", [tenantId, key]);
  await audit(db, tenantId, "owner", "automation.toggle", key);
  revalidatePath("/owner/marketing");
}
export async function resolveHandoff(fd: FormData) {
  const { tenantId, db } = await guard();
  await db.run("UPDATE handoffs SET status='resolved' WHERE id=?1 AND tenant_id=?2", [String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "handoff.resolve", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function saveDraft(fd: FormData) {
  const { tenantId, db } = await guard();
  const text = String(fd.get("text") ?? "").trim().slice(0, 2000);
  if (!text) return;
  await db.run("UPDATE knowledge_articles SET draft_answer=?1, updated_at=?4 WHERE id=?2 AND tenant_id=?3", [text, String(fd.get("id")), tenantId, nowIso()]);
  await audit(db, tenantId, "owner", "kb.draft", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function approveDraft(fd: FormData) {
  const { tenantId, db } = await guard();
  await db.run("UPDATE knowledge_articles SET answer=draft_answer, draft_answer=NULL, status='approved', approved_by='owner', updated_at=?3 WHERE id=?1 AND tenant_id=?2 AND draft_answer IS NOT NULL", [String(fd.get("id")), tenantId, nowIso()]);
  await audit(db, tenantId, "owner", "kb.approve", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function publishVersion() {
  const { tenantId, db } = await guard();
  const v = await publishKnowledge(db, tenantId, "owner");
  await audit(db, tenantId, "owner", "kb.publish", String(v));
  revalidatePath("/owner/ai");
}
export async function activateVersion(fd: FormData) {
  const { tenantId, db } = await guard();
  const v = Number(fd.get("version"));
  await db.run("UPDATE knowledge_versions SET active=(version=?2) WHERE tenant_id=?1", [tenantId, v]);
  await audit(db, tenantId, "owner", "kb.rollback", String(v));
  revalidatePath("/owner/ai");
}

/* ---------- Расписание: всё, что мастер задаёт сам ---------- */
const toMin = (v: FormDataEntryValue | null): number | null => {
  const m = String(v ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h <= 24 && mi <= 59 && h * 60 + mi <= 1440 ? h * 60 + mi : null;
};
const back = (code: string) => redirect(`/owner/schedule?m=${code}`);
const activeStaff = (db: Awaited<ReturnType<typeof getDb>>, tenantId: string) => db.all<{ id: string }>("SELECT id FROM staff WHERE tenant_id=?1 AND active=1", [tenantId]);

async function writeWeekly(db: Awaited<ReturnType<typeof getDb>>, tenantId: string, rules: { wd: number; a: number; b: number }[]) {
  const staff = await activeStaff(db, tenantId);
  const stmts: { sql: string; params: (string | number)[] }[] = [{ sql: "DELETE FROM availability_rules WHERE tenant_id=?1", params: [tenantId] }];
  for (const st of staff) for (const r of rules) stmts.push({ sql: "INSERT INTO availability_rules(id,tenant_id,staff_id,weekday,start_min,end_min) VALUES (?1,?2,?3,?4,?5,?6)", params: [crypto.randomUUID(), tenantId, st.id, r.wd, r.a, r.b] });
  await db.batch(stmts);
}
export async function saveWeekly(fd: FormData) {
  const { tenantId, db } = await guard();
  const rules: { wd: number; a: number; b: number }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (fd.get(`on${wd}`) !== "1") continue;
    for (const n of ["1", "2"]) {
      const a = toMin(fd.get(`a${wd}_${n}`)), b0 = toMin(fd.get(`b${wd}_${n}`));
      if (a == null || b0 == null) { if (n === "1") back("bad_time"); continue; }
      const b = b0 === 0 && a > 0 ? 1440 : b0;
      if (b <= a) back("bad_time");
      rules.push({ wd, a, b });
    }
  }
  await writeWeekly(db, tenantId, rules);
  await audit(db, tenantId, "owner", "schedule.weekly", String(rules.length));
  revalidatePath("/owner/schedule"); back("saved");
}
export async function applyDefaultSchedule() {
  const { tenantId, db } = await guard();
  await writeWeekly(db, tenantId, [1, 2, 3, 4, 5].map((wd) => ({ wd, a: 480, b: 1020 })));
  try { await db.run("INSERT INTO schedule_settings(tenant_id,step_min,min_notice_min,horizon_days) VALUES (?1,60,0,183) ON CONFLICT(tenant_id) DO UPDATE SET step_min=60,min_notice_min=0,horizon_days=183", [tenantId]); } catch { /* таблицы настроек ещё нет: работают значения по умолчанию */ }
  await audit(db, tenantId, "owner", "schedule.defaults");
  revalidatePath("/owner/schedule"); back("defaults");
}
export async function saveSettings(fd: FormData) {
  const { tenantId, db } = await guard();
  const step = Math.round(Number(fd.get("step"))), notice = Math.round(Number(fd.get("notice"))), horizon = Math.round(Number(fd.get("horizon")));
  if (!(step >= 5 && step <= 240) || !(notice >= 0 && notice <= 60 * 24 * 30) || !(horizon >= 1 && horizon <= 366)) back("bad_value");
  try { await db.run("INSERT INTO schedule_settings(tenant_id,step_min,min_notice_min,horizon_days) VALUES (?1,?2,?3,?4) ON CONFLICT(tenant_id) DO UPDATE SET step_min=?2,min_notice_min=?3,horizon_days=?4", [tenantId, step, notice, horizon]); }
  catch { back("migration"); }
  await audit(db, tenantId, "owner", "schedule.settings", `${step}/${notice}/${horizon}`);
  revalidatePath("/owner/schedule"); back("saved");
}
export async function addException(fd: FormData) {
  const { tenantId, db } = await guard();
  const day = String(fd.get("day") ?? ""), kind = String(fd.get("kind"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !["closed", "open"].includes(kind)) back("bad_value");
  let a = toMin(fd.get("from")), b = toMin(fd.get("to"));
  if (kind === "open" && (a == null || b == null)) back("bad_time");
  if (a == null || b == null) { a = null; b = null; } else { if (b === 0 && a > 0) b = 1440; if (b <= a) back("bad_time"); }
  try { await db.run("INSERT INTO schedule_exceptions(id,tenant_id,day,kind,start_min,end_min,note,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)", [crypto.randomUUID(), tenantId, day, kind, a, b, String(fd.get("note") ?? "").slice(0, 120) || null, nowIso()]); }
  catch { back("migration"); }
  await audit(db, tenantId, "owner", "schedule.exception.add", `${kind} ${day}`);
  revalidatePath("/owner/schedule"); back("saved");
}
export async function deleteException(fd: FormData) {
  const { tenantId, db } = await guard();
  try { await db.run("DELETE FROM schedule_exceptions WHERE id=?1 AND tenant_id=?2", [String(fd.get("id")), tenantId]); } catch { back("migration"); }
  await audit(db, tenantId, "owner", "schedule.exception.delete", String(fd.get("id")));
  revalidatePath("/owner/schedule"); back("saved");
}
export async function saveService(fd: FormData) {
  const { tenantId, db } = await guard();
  const dur = Math.round(Number(fd.get("duration"))), buf = Math.round(Number(fd.get("buffer")));
  if (!(dur >= 5 && dur <= 720) || !(buf >= 0 && buf <= 240)) back("bad_value");
  await db.run("UPDATE services SET duration_min=?1, buffer_min=?2 WHERE id=?3 AND tenant_id=?4", [dur, buf, String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "service.timing", String(fd.get("id")));
  revalidatePath("/owner/schedule"); back("saved");
}
/** Мастер сам ставит клиента на любой день и время (воскресенье, 17:15, поздний вечер): без проверки по рабочим часам, занятость защищена */
export async function manualBooking(fd: FormData) {
  const { tenantId, db } = await guard();
  const day = String(fd.get("day") ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/), min = toMin(fd.get("time"));
  if (!day || min == null || min >= 1440) back("bad_time");
  const z = zonedToUtc(+day![1], +day![2], +day![3], Math.floor(min! / 60), min! % 60);
  if (z.status !== "ok") back("bad_time");
  let code = "booked";
  try {
    await createBooking(db, {
      tenantId, serviceId: String(fd.get("service")), startsAtUtc: new Date((z as { utcMs: number }).utcMs).toISOString(),
      client: { name: String(fd.get("name") ?? ""), contact: String(fd.get("contact") ?? ""), locale: "ru" },
      idempotencyKey: crypto.randomUUID(), consentService: fd.get("consent") === "1", source: fd.get("test") === "1" ? { channel: "owner", test: "1" } : { channel: "owner" }, ownerOverride: true,
    });
  } catch (e) { code = e instanceof BookingError ? (e.code === "slot_taken" ? "taken" : e.code === "invalid" ? "bad_client" : "error") : "error"; }
  revalidatePath("/owner/schedule"); back(code);
}

/* ---------- Записи: подтвердить, перенести, отменить, отметить визит ---------- */
const safeBack = (v: FormDataEntryValue | null) => { const s = String(v ?? ""); return /^\/owner\/[A-Za-z0-9\/?=&%._-]*$/.test(s) ? s : ""; };
const apptBackOf = (fd: FormData, id: string, code: string) => { const b = safeBack(fd.get("back")); redirect(`/owner/appointments/${id}?m=${code}${b ? `&back=${encodeURIComponent(b)}` : ""}`); };
export async function setApptStatus(fd: FormData) {
  const { tenantId, db } = await guard();
  const id = String(fd.get("id")), status = String(fd.get("status")) as OwnerStatus;
  if (!["confirmed", "completed", "no_show"].includes(status)) apptBackOf(fd, id, "error");
  let code = "saved";
  try { await ownerSetStatus(db, { tenantId, id, status }); } catch { code = "error"; }
  revalidatePath("/owner/appointments"); apptBackOf(fd, id, code);
}
export async function cancelAppt(fd: FormData) {
  const { tenantId, db } = await guard();
  const id = String(fd.get("id"));
  let code = "cancelled";
  try { await ownerCancelBooking(db, tenantId, id); } catch { code = "error"; }
  revalidatePath("/owner/appointments"); apptBackOf(fd, id, code);
}
export async function rescheduleAppt(fd: FormData) {
  const { tenantId, db } = await guard();
  const id = String(fd.get("id"));
  const day = String(fd.get("day") ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/), min = toMin(fd.get("time"));
  if (!day || min == null || min >= 1440) apptBackOf(fd, id, "bad_time");
  const z = zonedToUtc(+day![1], +day![2], +day![3], Math.floor(min! / 60), min! % 60);
  if (z.status !== "ok") apptBackOf(fd, id, "bad_time");
  let code = "moved";
  try { await ownerRescheduleBooking(db, { tenantId, id, newStartUtc: new Date((z as { utcMs: number }).utcMs).toISOString() }); }
  catch (e) { code = e instanceof BookingError && e.code === "slot_taken" ? "taken" : "error"; }
  revalidatePath("/owner/appointments"); apptBackOf(fd, id, code);
}

/** Правила услуги: дни недели, окно начала, лимит в день, подготовка до записи (миграция 0005) */
export async function saveServiceRules(fd: FormData) {
  const { tenantId, db } = await guard();
  const id = String(fd.get("id"));
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => fd.get(`d${d}`) === "1");
  const a = toMin(fd.get("earliest")), b0 = toMin(fd.get("latest"));
  const b = b0 === 0 && a != null && a > 0 ? 1440 : b0;
  const maxRaw = String(fd.get("max") ?? "").trim(), max = maxRaw === "" ? null : Math.round(Number(maxRaw));
  const before = Math.round(Number(fd.get("before") || 0));
  if (days.length === 0 || (a != null && b != null && b <= a) || (max != null && !(max >= 1 && max <= 50)) || !(before >= 0 && before <= 240)) back("bad_value");
  try {
    await db.run("INSERT INTO service_rules(service_id,tenant_id,weekdays,earliest_min,latest_min,max_per_day,buffer_before_min,updated_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8 WHERE EXISTS (SELECT 1 FROM services WHERE id=?1 AND tenant_id=?2) ON CONFLICT(service_id) DO UPDATE SET weekdays=?3,earliest_min=?4,latest_min=?5,max_per_day=?6,buffer_before_min=?7,updated_at=?8",
      [id, tenantId, days.join(","), a, b, max, before, nowIso()]);
  } catch { back("migration"); }
  await audit(db, tenantId, "owner", "service.rules", id);
  revalidatePath("/owner/schedule"); back("saved");
}

const backCal = (code: string) => redirect(`/owner/calendar?m=${code}#waitlist`);
/** Лист ожидания: только запись в список, клиенту ничего не отправляется */
export async function addWaitlist(fd: FormData) {
  const { tenantId, db } = await guard();
  const name = String(fd.get("name") ?? "").trim().slice(0, 100), contact = String(fd.get("contact") ?? "").trim().slice(0, 120);
  const from = String(fd.get("from") ?? ""), to = String(fd.get("to") ?? "");
  const okDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!name || !contact || !okDay(from) || !okDay(to) || to < from || fd.get("consent") !== "1") backCal("wl_bad");
  let ok = true;
  try {
    await db.run("INSERT INTO waitlist(id,tenant_id,service_id,client_name,contact,day_from,day_to,note,consent_contact,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,1,?9 WHERE EXISTS (SELECT 1 FROM services WHERE id=?3 AND tenant_id=?2)",
      [crypto.randomUUID(), tenantId, String(fd.get("service")), name, contact, from, to, String(fd.get("note") ?? "").slice(0, 200) || null, nowIso()]);
  } catch { ok = false; }
  if (!ok) backCal("wl_migration");
  await audit(db, tenantId, "owner", "waitlist.add", `${from}..${to}`);
  revalidatePath("/owner/calendar"); backCal("wl_added");
}
export async function setWaitlistStatus(fd: FormData) {
  const { tenantId, db } = await guard();
  const st = String(fd.get("status"));
  if (!["waiting", "offered", "booked", "removed"].includes(st)) backCal("wl_bad");
  await db.run("UPDATE waitlist SET status=?1 WHERE id=?2 AND tenant_id=?3", [st, String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "waitlist.status", `${String(fd.get("id"))} ${st}`);
  revalidatePath("/owner/calendar"); backCal("wl_saved");
}
