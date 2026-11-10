"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookingError, createBooking } from "@/lib/booking";
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
      idempotencyKey: crypto.randomUUID(), consentService: fd.get("consent") === "1", source: { channel: "owner" }, ownerOverride: true,
    });
  } catch (e) { code = e instanceof BookingError ? (e.code === "slot_taken" ? "taken" : e.code === "invalid" ? "bad_client" : "error") : "error"; }
  revalidatePath("/owner/schedule"); back(code);
}
