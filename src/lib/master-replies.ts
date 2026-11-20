import { auditStmt, js, nowIso, one, rows, uuid, type Db } from "./db";

/** Очередь вопросов мастеру: ответ мастера из кабинета попадает в тот же диалог и возвращается клиенту. */
export async function replyToHandoff(db: Db, tenantId: string, handoffId: string, text: string, by = "owner"): Promise<boolean> {
  const body = text.trim().slice(0, 1500);
  if (!body) return false;
  const h = await one<{ id: string; conversation_id: string; status: string }>(db, "SELECT id,conversation_id,status FROM handoffs WHERE id=?1 AND tenant_id=?2", [handoffId, tenantId]);
  if (!h) return false;
  const at = nowIso();
  await db.batch([
    { sql: "INSERT INTO messages(id,conversation_id,role,content,meta,created_at) VALUES (?1,?2,'assistant',?3,?4,?5)", params: [uuid(), h.conversation_id, body, js({ kind: "master_reply", handoffId }), at] },
    { sql: "UPDATE handoffs SET status='resolved' WHERE id=?1 AND tenant_id=?2", params: [handoffId, tenantId] },
    auditStmt(tenantId, by, "handoff.reply", handoffId),
  ]);
  return true;
}

/** Только ответы мастера (а не весь диалог) и только по идентификатору диалога, известному клиенту. */
export async function masterRepliesSince(db: Db, tenantId: string, conversationId: string, afterIso: string) {
  const after = /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(afterIso) ? afterIso : "1970-01-01T00:00:00.000Z";
  return rows<{ id: string; content: string; created_at: string }>(db,
    `SELECT m.id,m.content,m.created_at FROM messages m JOIN conversations c ON c.id=m.conversation_id
     WHERE c.id=?1 AND c.tenant_id=?2 AND m.role='assistant' AND json_extract(m.meta,'$.kind')='master_reply' AND m.created_at>?3 ORDER BY m.created_at, m.rowid LIMIT 20`, [conversationId, tenantId, after]);
}
