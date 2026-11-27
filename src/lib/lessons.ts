import { auditStmt, nowIso, one, type Db } from "./db";

export const LESSON_TOPICS: Record<string, string> = { consultation: "Консультация", extensions: "Наращивание волос", preparation: "Подготовка к визиту", price: "Цены", technique: "Своя техника мастера" };
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

export type Group = { key: string; count: number; sample: string; ids: string[]; last: string };
/** Вопросы без контакта: одинаковые по тексту складываются в одну строку со счётчиком, самые частые сверху. */
export function groupQuestions(hs: { id: string; summary: string; created_at: string }[]): Group[] {
  const m = new Map<string, Group>();
  for (const h of hs) {
    const k = norm(h.summary).slice(0, 80) || h.id;
    const g = m.get(k) ?? { key: k, count: 0, sample: h.summary, ids: [], last: h.created_at };
    g.count++; g.ids.push(h.id); if (h.created_at > g.last) g.last = h.created_at; m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1));
}

/** Кладёт пару «вопрос и ответ» в ЧЕРНОВИК темы. Клиентам попадёт только после «Утвердить» и «Опубликовать версию». */
export async function rememberForAi(db: Db, tenantId: string, topic: string, question: string, answer: string, by = "owner"): Promise<"ok" | "bad" | "too_long"> {
  const a = answer.trim(), q = question.trim().slice(0, 300);
  if (!a || !LESSON_TOPICS[topic]) return "bad";
  const art = await one<{ id: string; answer: string; draft_answer: string | null }>(db, "SELECT id,answer,draft_answer FROM knowledge_articles WHERE tenant_id=?1 AND key=?2 AND locale='ru'", [tenantId, topic]);
  if (!art) return "bad";
  const next = `${art.draft_answer ?? art.answer}\n\nЕсли спрашивают «${q}»: ${a}`;
  if (next.length > 2000) return "too_long";
  await db.batch([
    { sql: "UPDATE knowledge_articles SET draft_answer=?1, updated_at=?2 WHERE id=?3 AND tenant_id=?4", params: [next, nowIso(), art.id, tenantId] },
    auditStmt(tenantId, by, "kb.lesson", topic),
  ]);
  return "ok";
}

export async function resolveMany(db: Db, tenantId: string, ids: string[]) {
  for (const id of ids.slice(0, 200)) await db.run("UPDATE handoffs SET status='resolved' WHERE id=?1 AND tenant_id=?2", [id, tenantId]);
}
