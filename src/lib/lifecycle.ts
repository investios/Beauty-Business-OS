import { nowIso, one, rows, uuid, auditStmt, type Db } from "./db";
import { deliverEmail } from "./notify";
import { SITE_URL } from "./seo";
import { IS_MARKETING, PREVIEW_LINK, render, type MsgKind } from "./lifecycle-templates";
import { formatLocal, localParts, zonedToUtc, addLocalDays } from "./tz";

/** Сообщения жизненного цикла. По умолчанию ПРОБНЫЙ режим: тексты формируются и сохраняются, наружу ничего не уходит.
 *  Реальная отправка включается только флагом LIFECYCLE_SEND=1 и настроенным провайдером почты. */
export const LIFECYCLE_KINDS: MsgKind[] = ["reminder_24h", "followup", "rebook"];
export const FOLLOWUP_AFTER_H = 24;
export const REBOOK_AFTER_DAYS = 28;
export const QUIET_FROM_H = 20, QUIET_TO_H = 9; // тихие часы по Дублину: с 20:00 до 09:00 не отправляем

const startMs = (iso: string) => new Date(iso).getTime();
export const inQuietHours = (ms: number) => { const h = localParts(ms).h; return h >= QUIET_FROM_H || h < QUIET_TO_H; };
/** Сдвигает момент отправки на ближайшие 09:00, если он попал на тихие часы */
export function toSendWindow(ms: number): number {
  if (!inQuietHours(ms)) return ms;
  const p = localParts(ms);
  const day = p.h >= QUIET_FROM_H ? addLocalDays(p.y, p.mo, p.d, 1) : { y: p.y, mo: p.mo, d: p.d };
  const z = zonedToUtc(day.y, day.mo, day.d, QUIET_TO_H, 0);
  return z.status === "ok" ? z.utcMs : ms + 3600000;
}

export type RunOpts = { nowMs: number; assumeVisits?: boolean; send?: boolean };
export type RunResult = { planned: number; simulated: number; sent: number; failed: number; skipped: number; waiting: number; ready: boolean };

async function tableReady(db: Db) { try { await rows(db, "SELECT 1 FROM lifecycle_messages LIMIT 1"); return true; } catch { return false; } }

/** Создаёт недостающие задачи «как прошёл визит» и «повторный визит» и снимает задачи по неактивным записям. Повторный вызов ничего не дублирует. */
export async function planLifecycle(db: Db, tenantId: string, o: RunOpts): Promise<number> {
  const now = new Date(o.nowMs).toISOString();
  await db.run(`UPDATE notifications SET status='cancelled' WHERE tenant_id=?1 AND status='queued' AND kind IN ('reminder_24h','followup','rebook')
    AND appointment_id IN (SELECT id FROM appointments WHERE tenant_id=?1 AND status IN ('cancelled','no_show','held'))`, [tenantId]);
  const done = o.assumeVisits ? "('completed','confirmed')" : "('completed')";
  const appts = await rows<{ id: string; end_at: string }>(db, `SELECT id,end_at FROM appointments WHERE tenant_id=?1 AND client_id IS NOT NULL AND status IN ${done} AND end_at <= ?2 AND end_at > ?3`,
    [tenantId, o.assumeVisits ? new Date(o.nowMs + 40 * 86400000).toISOString() : now, new Date(o.nowMs - 90 * 86400000).toISOString()]);
  let n = 0;
  for (const a of appts) {
    for (const [kind, due] of [["followup", startMs(a.end_at) + FOLLOWUP_AFTER_H * 3600000], ["rebook", startMs(a.end_at) + REBOOK_AFTER_DAYS * 86400000]] as const) {
      const r = await db.run(`INSERT INTO notifications(id,tenant_id,appointment_id,kind,status,scheduled_for,created_at)
        SELECT ?1,?2,?3,?4,'queued',?5,?6 WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE appointment_id=?3 AND kind=?4 AND status<>'cancelled')`,
        [uuid(), tenantId, a.id, kind, new Date(toSendWindow(due)).toISOString(), now]);
      n += r.changes;
    }
  }
  return n;
}

type Job = { id: string; kind: MsgKind; appointment_id: string; scheduled_for: string };

export async function runLifecycle(db: Db, tenantId: string, o: RunOpts): Promise<RunResult> {
  const res: RunResult = { planned: 0, simulated: 0, sent: 0, failed: 0, skipped: 0, waiting: 0, ready: true };
  if (!(await tableReady(db))) return { ...res, ready: false };
  res.planned = await planLifecycle(db, tenantId, o);
  const jobs = await rows<Job>(db, "SELECT id,kind,appointment_id,scheduled_for FROM notifications WHERE tenant_id=?1 AND status='queued' AND kind IN ('reminder_24h','followup','rebook') AND scheduled_for <= ?2 ORDER BY scheduled_for LIMIT 200", [tenantId, new Date(o.nowMs).toISOString()]);
  for (const j of jobs) {
    const c = await one<{ status: string; start_at: string; manage_token: string; appt_locale: string; name: string; contact: string; preferred_locale: string; client_id: string; title_i18n: Record<string, string>; salon: string }>(db,
      `SELECT a.status,a.start_at,a.manage_token,a.locale appt_locale,c.name,c.contact,c.preferred_locale,c.id client_id,s.title_i18n,t.name salon
       FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id JOIN tenants t ON t.id=a.tenant_id WHERE a.id=?1 AND a.tenant_id=?2`, [j.appointment_id, tenantId]);
    const finish = async (status: "cancelled" | "not_configured" | "sent" | "failed", mode: "skipped" | "simulated" | "sent" | "failed", extra: { reason?: string; subject?: string; body?: string; locale?: string; error?: string }) => {
      const r = await db.run("UPDATE notifications SET status=?1,error=?2 WHERE id=?3 AND tenant_id=?4 AND status='queued'", [status, extra.error ?? extra.reason ?? null, j.id, tenantId]);
      if (r.changes !== 1) return; // уже обработано другим запуском
      await db.run("INSERT INTO lifecycle_messages(notification_id,tenant_id,locale,subject,body,mode,skip_reason,processed_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        [j.id, tenantId, extra.locale ?? "en", extra.subject ?? null, extra.body ?? null, mode, extra.reason ?? null, nowIso()]);
      if (mode === "skipped") res.skipped++; else if (mode === "simulated") res.simulated++; else if (mode === "sent") res.sent++; else res.failed++;
    };
    if (!c) { await finish("cancelled", "skipped", { reason: "appointment_missing" }); continue; }
    const visitDone = c.status === "completed" || (o.assumeVisits && c.status === "confirmed");
    const okStatus = j.kind === "reminder_24h" ? c.status === "confirmed" || c.status === "requested" : visitDone;
    if (!okStatus) { await finish("cancelled", "skipped", { reason: "appointment_not_active" }); continue; }
    if (j.kind === "reminder_24h" && startMs(c.start_at) <= o.nowMs) { await finish("cancelled", "skipped", { reason: "visit_already_started" }); continue; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.contact)) { await finish("cancelled", "skipped", { reason: "contact_not_email" }); continue; }
    const cons = async (p: "service" | "marketing") => !!(await one(db, "SELECT 1 FROM consents WHERE client_id=?1 AND tenant_id=?2 AND purpose=?3 AND withdrawn_at IS NULL LIMIT 1", [c.client_id, tenantId, p]));
    if (!(await cons("service"))) { await finish("cancelled", "skipped", { reason: "no_service_consent" }); continue; }
    if (IS_MARKETING[j.kind] && !(await cons("marketing"))) { await finish("cancelled", "skipped", { reason: "no_marketing_consent" }); continue; }
    if (inQuietHours(o.nowMs)) { res.waiting++; continue; } // подождёт утра
    const loc = c.appt_locale || c.preferred_locale || "en";
    const base = { name: c.name, salon: c.salon, service: c.title_i18n?.[loc] ?? c.title_i18n?.en ?? "", when: formatLocal(startMs(c.start_at), loc) };
    if (o.send && process.env.LIFECYCLE_SEND === "1") {
      const m = render(j.kind, loc, { ...base, manageUrl: `${SITE_URL}/${loc}/manage/${j.appointment_id}?token=${c.manage_token}` });
      const st = await deliverEmail(c.contact, m.subject, m.body);
      if (st === "sent") await finish("sent", "sent", { locale: loc, subject: m.subject, body: render(j.kind, loc, { ...base, manageUrl: PREVIEW_LINK }).body });
      else await finish("failed", "failed", { locale: loc, error: st === "not_configured" ? "provider_not_configured" : "delivery_failed" });
    } else {
      const m = render(j.kind, loc, { ...base, manageUrl: PREVIEW_LINK });
      await finish("not_configured", "simulated", { locale: loc, subject: m.subject, body: m.body });
    }
  }
  await db.batch([auditStmt(tenantId, "owner", "lifecycle.run", o.send ? "send" : "simulation", { jobs: jobs.length, ...res })]);
  return res;
}
