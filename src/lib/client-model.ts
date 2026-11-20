import { auditStmt, nowIso, one, rows, uuid, type Db } from "./db";
import { getPolicies } from "./policies";

/** Статусы клиентов (ТЗ v2.0). inactive и archived ставит только мастер; остальные считает система по циклу визитов. */
export type ClientStatus = "active" | "overdue" | "at_risk" | "lost" | "inactive" | "archived";
export const STATUS_LABEL: Record<ClientStatus, string> = { active: "Активный", overdue: "Просрочен цикл", at_risk: "Риск ухода", lost: "Потерян", inactive: "Неактивный", archived: "Архив" };
export const STATUS_HELP: Record<ClientStatus, string> = {
  active: "Был недавно или есть запись впереди", overdue: "Прошёл один цикл без визита", at_risk: "Прошло два цикла без визита",
  lost: "Три и более цикла без визита", inactive: "Поставлено мастером вручную", archived: "Убран из рабочих списков мастером",
};
export const CHANNELS = ["email", "phone", "whatsapp", "instagram", "messenger"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { email: "E-mail", phone: "Телефон", whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger" };
export const NOTE_CATEGORIES = ["preference", "technical", "health", "payment", "communication", "other"] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];
export const NOTE_LABEL: Record<NoteCategory, string> = { preference: "Пожелания", technical: "Технические детали", health: "Здоровье и противопоказания", payment: "Оплата", communication: "Общение", other: "Другое" };

const DAY = 86400000;
/** Статус по циклу. Правило ТЗ: три пропущенных цикла = потерян. Запись впереди возвращает в «активный». */
export function computeStatus(p: { lastVisit: string | null; hasUpcoming: boolean; intervalDays: number; now: Date; createdAt: string }): ClientStatus {
  if (p.hasUpcoming) return "active";
  const base = p.lastVisit ?? p.createdAt;
  const days = Math.max(0, (p.now.getTime() - new Date(base).getTime()) / DAY);
  const cycles = days / Math.max(1, p.intervalDays);
  if (cycles < 1) return "active";
  if (cycles < 2) return "overdue";
  if (cycles < 3) return "at_risk";
  return "lost";
}

/** Пересчитывает статусы салона. Ручные inactive/archived не трогает, пока не появится новый состоявшийся визит. Без таблиц (миграция 0010) ничего не делает. */
export async function refreshClientStatuses(db: Db, tenantId: string, now = new Date()): Promise<{ changed: number; persisted: boolean }> {
  try {
    const interval = (await getPolicies(db, tenantId)).values.rebook_after_days;
    const list = await rows<{ id: string; created_at: string; last_visit: string | null; upcoming: number; status: string | null; manual: number | null; st_at: string | null }>(db,
      `SELECT c.id,c.created_at,
        (SELECT max(a.start_at) FROM appointments a WHERE a.client_id=c.id AND a.status='completed') last_visit,
        (SELECT count(*) FROM appointments a WHERE a.client_id=c.id AND a.status='confirmed' AND a.start_at>?2) upcoming,
        s.status,s.manual,s.status_updated_at st_at
       FROM clients c LEFT JOIN client_state s ON s.client_id=c.id WHERE c.tenant_id=?1`, [tenantId, now.toISOString()]);
    let changed = 0; const at = nowIso(); const st: { sql: string; params: (string | number | null)[] }[] = [];
    for (const c of list) {
      const visitedAfterManual = c.manual && c.last_visit && c.st_at && c.last_visit > c.st_at;
      if (c.manual && !visitedAfterManual) continue;
      const next = computeStatus({ lastVisit: c.last_visit, hasUpcoming: c.upcoming > 0, intervalDays: interval, now, createdAt: c.created_at });
      if (c.status === next && !c.manual) continue;
      changed++;
      st.push({ sql: "INSERT INTO client_state(client_id,tenant_id,status,manual,status_updated_at) VALUES (?1,?2,?3,0,?4) ON CONFLICT(client_id) DO UPDATE SET status=?3,manual=0,status_updated_at=?4", params: [c.id, tenantId, next, at] });
      st.push({ sql: "INSERT INTO client_status_history(id,tenant_id,client_id,status,reason,changed_by,created_at) VALUES (?1,?2,?3,?4,?5,'system',?6)", params: [uuid(), tenantId, c.id, next, visitedAfterManual ? "новый визит, статус возвращён автоматически" : "пересчёт по циклу визитов", at] });
    }
    for (let i = 0; i < st.length; i += 50) await db.batch(st.slice(i, i + 50));
    return { changed, persisted: true };
  } catch { return { changed: 0, persisted: false }; }
}

export async function setClientStatus(db: Db, tenantId: string, clientId: string, status: ClientStatus, reason: string, by: string): Promise<boolean> {
  if (!STATUS_LABEL[status]) return false;
  const c = await one<{ id: string }>(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]);
  if (!c) return false;
  const at = nowIso();
  await db.batch([
    { sql: "INSERT INTO client_state(client_id,tenant_id,status,manual,status_updated_at) VALUES (?1,?2,?3,1,?4) ON CONFLICT(client_id) DO UPDATE SET status=?3,manual=1,status_updated_at=?4", params: [clientId, tenantId, status, at] },
    { sql: "INSERT INTO client_status_history(id,tenant_id,client_id,status,reason,changed_by,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [uuid(), tenantId, clientId, status, reason.slice(0, 300) || "вручную", by, at] },
    auditStmt(tenantId, by, "client.status", clientId, { status }),
  ]);
  return true;
}

export async function setPreferredChannel(db: Db, tenantId: string, clientId: string, channel: string, by: string): Promise<boolean> {
  if (!(CHANNELS as readonly string[]).includes(channel)) return false;
  const c = await one<{ id: string }>(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]);
  if (!c) return false;
  await db.batch([
    { sql: "INSERT INTO client_state(client_id,tenant_id,status,manual,preferred_channel,status_updated_at) VALUES (?1,?2,'active',0,?3,?4) ON CONFLICT(client_id) DO UPDATE SET preferred_channel=?3", params: [clientId, tenantId, channel, nowIso()] },
    auditStmt(tenantId, by, "client.channel", clientId, { channel }),
  ]);
  return true;
}

export async function addNote(db: Db, tenantId: string, clientId: string, category: string, body: string, by: string): Promise<boolean> {
  const text = body.trim().slice(0, 1500);
  if (!text || !(NOTE_CATEGORIES as readonly string[]).includes(category)) return false;
  if (!(await one(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]))) return false;
  await db.batch([
    { sql: "INSERT INTO client_notes(id,tenant_id,client_id,category,body,author,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [uuid(), tenantId, clientId, category, text, by, nowIso()] },
    auditStmt(tenantId, by, "client.note", clientId, { category }),
  ]);
  return true;
}

export async function addComplaint(db: Db, tenantId: string, clientId: string, body: string, by: string, appointmentId?: string | null): Promise<boolean> {
  const text = body.trim().slice(0, 2000);
  if (!text) return false;
  if (!(await one(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]))) return false;
  const id = uuid();
  await db.batch([
    { sql: "INSERT INTO complaints(id,tenant_id,client_id,appointment_id,body,created_at) VALUES (?1,?2,?3,?4,?5,?6)", params: [id, tenantId, clientId, appointmentId ?? null, text, nowIso()] },
    auditStmt(tenantId, by, "complaint.add", id),
  ]);
  return true;
}

export async function resolveComplaint(db: Db, tenantId: string, id: string, resolution: string, by: string): Promise<boolean> {
  const r = await db.run("UPDATE complaints SET status='resolved', resolution=?3, resolved_at=?4 WHERE id=?1 AND tenant_id=?2 AND status='open'", [id, tenantId, resolution.trim().slice(0, 1000), nowIso()]);
  if (!r.changes) return false;
  const a = auditStmt(tenantId, by, "complaint.resolve", id); await db.run(a.sql, a.params);
  return true;
}

export async function addReview(db: Db, tenantId: string, clientId: string, rating: number, body: string, by: string, source = "manual"): Promise<boolean> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return false;
  if (!(await one(db, "SELECT id FROM clients WHERE id=?1 AND tenant_id=?2", [clientId, tenantId]))) return false;
  const id = uuid();
  await db.batch([
    { sql: "INSERT INTO reviews(id,tenant_id,client_id,rating,body,source,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params: [id, tenantId, clientId, rating, body.trim().slice(0, 1500), source, nowIso()] },
    auditStmt(tenantId, by, "review.add", id, { rating }),
  ]);
  return true;
}
