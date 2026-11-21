import { auditStmt, nowIso, one, rows, type Db } from "./db";

/** Клиент нажал «Отменить» или «Перенести» на странице записи, когда до визита меньше лимита отмены.
 *  Запись не меняется. Мастеру создаётся вопрос с контактом клиента: ответить в чат нельзя, клиента в чате нет.
 *  Вызывать только после проверки личного токена записи. Повторное нажатие не создаёт второй вопрос. */
export async function lateChangeHandoff(db: Db, tenantId: string, appointmentId: string, kind: "cancel" | "reschedule"): Promise<boolean> {
  try {
    const a = await one<{ id: string; start_at: string; client_id: string | null; locale: string | null; title: string | null }>(db,
      `SELECT a.id, a.start_at, a.client_id, a.locale, s.title_i18n title FROM appointments a LEFT JOIN services s ON s.id=a.service_id WHERE a.id=?1 AND a.tenant_id=?2`, [appointmentId, tenantId]);
    if (!a) return false;
    const conv = `late-${a.id}`;
    const open = await one<{ id: string }>(db, "SELECT id FROM handoffs WHERE conversation_id=?1 AND status='open' LIMIT 1", [conv]);
    if (open) return true;
    const client = a.client_id ? await one<{ name: string; contact: string }>(db, "SELECT name,contact FROM clients WHERE id=?1 AND tenant_id=?2", [a.client_id, tenantId]) : null;
    let service = "";
    try { service = (JSON.parse(a.title ?? "{}") as Record<string, string>).ru ?? ""; } catch { /* название необязательно */ }
    const when = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(a.start_at));
    const summary = `${client?.name ?? "Клиент"} просит ${kind === "cancel" ? "отменить" : "перенести"} запись${service ? ` «${service}»` : ""} на ${when} со страницы записи. До визита меньше лимита, онлайн изменить нельзя. Ответьте клиенту по контакту: чата с ним нет.`;
    const hid = crypto.randomUUID(), at = nowIso();
    await db.batch([
      { sql: "INSERT OR IGNORE INTO conversations(id,tenant_id,client_id,channel,locale,created_at) VALUES (?1,?2,?3,'manage',?4,?5)", params: [conv, tenantId, a.client_id, ["ru", "en", "uk"].includes(a.locale ?? "") ? a.locale : "ru", at] },
      { sql: "INSERT INTO handoffs(id,tenant_id,conversation_id,reason,summary,contact,created_at) VALUES (?1,?2,?3,'late_change',?4,?5,?6)", params: [hid, tenantId, conv, summary, client?.contact ?? null, at] },
      auditStmt(tenantId, "guest", "handoff.create", hid, { reason: "late_change", via: "manage_page", kind }),
    ]);
    return true;
  } catch { return false; }
}
void rows;
