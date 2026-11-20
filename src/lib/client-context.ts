import { auditStmt, nowIso, one, rows, uuid, type Db } from "./db";

type Loc = "en" | "ru" | "uk";
/** Клиент считается узнанным только после проверки защищённой ссылки записи. По имени, почте или телефону из сообщения история не раскрывается. */
export async function recognizeClient(db: Db, tenantId: string, conversationId: string, clientId: string) {
  await db.run("UPDATE conversations SET client_id=?3 WHERE id=?1 AND tenant_id=?2 AND client_id IS NULL", [conversationId, tenantId, clientId]);
}
export async function clientContext(db: Db, tenantId: string, conversationId: string, now = new Date()) {
  const c = await one<{ id: string; name: string }>(db, "SELECT cl.id,cl.name FROM conversations cv JOIN clients cl ON cl.id=cv.client_id WHERE cv.id=?1 AND cv.tenant_id=?2 AND cl.tenant_id=?2", [conversationId, tenantId]);
  if (!c) return null;
  const last = await one<{ start_at: string; title_i18n: Record<string, string> }>(db, "SELECT a.start_at,s.title_i18n FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.client_id=?1 AND a.tenant_id=?2 AND a.status IN ('completed','confirmed') AND a.start_at<=?3 ORDER BY a.start_at DESC LIMIT 1", [c.id, tenantId, now.toISOString()]);
  const next = await one<{ start_at: string }>(db, "SELECT start_at FROM appointments WHERE client_id=?1 AND tenant_id=?2 AND status='confirmed' AND start_at>?3 ORDER BY start_at LIMIT 1", [c.id, tenantId, now.toISOString()]);
  return { clientId: c.id, firstName: c.name.trim().split(/\s+/)[0], lastService: last?.title_i18n ?? null, lastVisit: last?.start_at ?? null, nextVisit: next?.start_at ?? null };
}
export const HELLO: Record<Loc, (n: string) => string> = {
  en: (n) => `Hello, ${n}! I recognised your booking.`, ru: (n) => `Здравствуйте, ${n}! Узнал вашу запись.`, uk: (n) => `Вітаю, ${n}! Упізнав ваш запис.`,
};
/** Заметка от ИИ в карточку: помечена как исходящая от ИИ, а не как факт о клиенте. */
export async function addAiNote(db: Db, tenantId: string, clientId: string, body: string) {
  try {
    await db.batch([
      { sql: "INSERT INTO client_notes(id,tenant_id,client_id,category,body,author,created_at) VALUES (?1,?2,?3,'communication',?4,'ai',?5)", params: [uuid(), tenantId, clientId, `От ИИ: ${body.slice(0, 400)}`, nowIso()] },
      auditStmt(tenantId, "ai", "ai.addAiNote", clientId),
    ]);
    return true;
  } catch { return false; }
}
export async function recentAiNotes(db: Db, tenantId: string, clientId: string) {
  return rows<{ body: string }>(db, "SELECT body FROM client_notes WHERE tenant_id=?1 AND client_id=?2 AND author='ai' ORDER BY created_at DESC LIMIT 3", [tenantId, clientId]).catch(() => []);
}
