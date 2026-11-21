import { audit, nowIso, rows, one, type Db } from "./db";
import { compute } from "./consulting";
import { POLICY_DEFS, POLICY_KEYS, getPolicies } from "./policies";
import { evalResults } from "./consultant-eval";

/** Панель владельца платформы: полный доступ ко всем данным салона для анализа.
 *  Здесь, в отличие от консультанта, есть тексты диалогов, жалобы и ответы мастера. Каждый просмотр и выгрузка пишутся в журнал. */
const safe = async <T,>(f: () => Promise<T>, d: T) => { try { return await f(); } catch { return d; } };

export type TenantRow = { id: string; name: string; slug: string; is_demo: number | boolean; created_at: string };
export const listTenants = (db: Db) => rows<TenantRow>(db, "SELECT id,name,slug,is_demo,created_at FROM tenants ORDER BY created_at, rowid");

export type Transcript = {
  id: string; channel: string; locale: string; created_at: string; client: string | null; state: string;
  messages: { role: string; content: string; at: string; kind: string; intents: string[]; engine: string; tools: { tool: string; ok: boolean; detail?: string }[] }[];
  handoffs: { id: string; reason: string; status: string; summary: string; contact: string | null; created_at: string }[];
};

export async function transcripts(db: Db, tenantId: string, days: number, limit = 300): Promise<Transcript[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const convs = await rows<{ id: string; channel: string; locale: string; created_at: string; state: string; cname: string | null }>(db,
    `SELECT c.id,c.channel,c.locale,c.created_at,c.state,cl.name cname FROM conversations c LEFT JOIN clients cl ON cl.id=c.client_id
     WHERE c.tenant_id=?1 AND c.created_at>=?2 ORDER BY c.created_at DESC LIMIT ?3`, [tenantId, since, limit]);
  const out: Transcript[] = [];
  for (const c of convs) {
    const ms = await rows<{ role: string; content: string; meta: string; created_at: string }>(db, "SELECT role,content,meta,created_at FROM messages WHERE conversation_id=?1 ORDER BY created_at, rowid", [c.id]);
    const hs = await rows<Transcript["handoffs"][number]>(db, "SELECT id,reason,status,summary,contact,created_at FROM handoffs WHERE conversation_id=?1 AND tenant_id=?2 ORDER BY created_at", [c.id, tenantId]);
    out.push({
      id: c.id, channel: c.channel, locale: c.locale, created_at: c.created_at, client: c.cname, state: c.state,
      messages: ms.map((m) => {
        let meta: { kind?: string; intents?: string[]; engine?: string; tools?: { tool: string; ok: boolean; detail?: string }[] } = {};
        try { meta = typeof m.meta === "string" ? JSON.parse(m.meta || "{}") : ((m.meta as unknown) ?? {}); } catch { /* пусто */ }
        return { role: m.role, content: m.content, at: m.created_at, kind: meta.kind ?? "", intents: meta.intents ?? [], engine: meta.engine ?? "", tools: meta.tools ?? [] };
      }),
      handoffs: hs,
    });
  }
  return out;
}

export async function serviceStats(db: Db, tenantId: string, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return safe(() => rows<{ slug: string; title: string; active: number; price_mode: string; price_from_cents: number | null; created: number; completed: number; cancelled: number; no_show: number; requested: number; confirmed: number }>(db,
    `SELECT s.slug, s.title_i18n title, s.active, s.price_mode, s.price_from_cents,
       COALESCE(SUM(CASE WHEN a.status<>'held' THEN 1 ELSE 0 END),0) created,
       COALESCE(SUM(a.status='completed'),0) completed, COALESCE(SUM(a.status='cancelled'),0) cancelled, COALESCE(SUM(a.status='no_show'),0) no_show,
       COALESCE(SUM(a.status='requested'),0) requested, COALESCE(SUM(a.status='confirmed'),0) confirmed
     FROM services s LEFT JOIN appointments a ON a.service_id=s.id AND a.tenant_id=s.tenant_id AND a.created_at>=?2
     WHERE s.tenant_id=?1 GROUP BY s.id ORDER BY created DESC, s.slug`, [tenantId, since]), []);
}

export async function complaintRows(db: Db, tenantId: string, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return safe(() => rows<{ id: string; client: string; body: string; status: string; resolution: string | null; created_at: string; resolved_at: string | null }>(db,
    `SELECT c.id, cl.name client, c.body, c.status, c.resolution, c.created_at, c.resolved_at FROM complaints c JOIN clients cl ON cl.id=c.client_id
     WHERE c.tenant_id=?1 AND c.created_at>=?2 ORDER BY c.created_at DESC`, [tenantId, since]), []);
}

/** Использование инструментов ИИ и движков ответов по сообщениям ассистента: что отвечал скрипт, что модель, что мастер. */
export async function aiUsage(db: Db, tenantId: string, days: number) {
  const t = await transcripts(db, tenantId, days, 1000);
  const engines: Record<string, number> = {}, tools: Record<string, { n: number; ok: number }> = {}, intents: Record<string, number> = {};
  let assistant = 0, master = 0, llmRefused = 0;
  for (const c of t) for (const m of c.messages) {
    if (m.role !== "assistant") continue;
    if (m.kind === "master_reply") { master++; continue; }
    assistant++;
    if (m.engine) engines[m.engine] = (engines[m.engine] ?? 0) + 1;
    for (const i of m.intents) intents[i] = (intents[i] ?? 0) + 1;
    for (const x of m.tools) { const e = (tools[x.tool] ??= { n: 0, ok: 0 }); e.n++; if (x.ok) e.ok++; if (x.tool === "llm" && !x.ok) llmRefused++; }
  }
  return { conversations: t.length, assistant, master, llmRefused, engines, intents, tools };
}

export const tenantSettings = async (db: Db, tenantId: string) => {
  const { values } = await getPolicies(db, tenantId);
  return POLICY_KEYS.map((k) => ({ key: k, label: POLICY_DEFS[k].label, value: values[k], isDefault: values[k] === POLICY_DEFS[k].def }));
};

export async function jobsSummary(db: Db, tenantId: string) {
  return safe(() => rows<{ kind: string; status: string; n: number }>(db, "SELECT kind,status,count(*) n FROM jobs WHERE tenant_id=?1 GROUP BY kind,status ORDER BY kind", [tenantId]), []);
}
export async function accessLog(db: Db, limit = 100) {
  return safe(() => rows<{ at: string; action: string; target: string | null }>(db, "SELECT at,action,target FROM audit_events WHERE actor='platform' ORDER BY at DESC, rowid DESC LIMIT ?1", [limit]), []);
}

/** Полный отчёт для анализа и решений: всё в одном JSON. */
export async function fullReport(db: Db, tenantId: string, days = 90) {
  const t = await one<TenantRow>(db, "SELECT id,name,slug,is_demo,created_at FROM tenants WHERE id=?1", [tenantId]);
  if (!t) return null;
  const [aggregates, tr, services, complaints, ai, settings, jobs, evals] = await Promise.all([
    compute(db, tenantId, Date.now(), days), transcripts(db, tenantId, days, 1000), serviceStats(db, tenantId, days), complaintRows(db, tenantId, days),
    aiUsage(db, tenantId, days), tenantSettings(db, tenantId), jobsSummary(db, tenantId), evalResults(db, tenantId, 500),
  ]);
  return { generatedAt: nowIso(), periodDays: days, tenant: { id: t.id, name: t.name, slug: t.slug }, aggregates, aiUsage: ai, services, complaints, settings, jobs, consultantEval: evals, conversations: tr };
}

const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
/** CSV с диалогами: одна строка на сообщение. Начало ячейки с =,+,-,@ экранируется, чтобы таблица не исполнила формулу. */
const cell = (v: unknown) => { const s = String(v ?? ""); return q(/^[=+\-@\t]/.test(s) ? "'" + s : s); };
export function conversationsCsv(t: Transcript[]): string {
  const head = ["conversation_id", "started_at", "locale", "client", "at", "role", "kind", "engine", "intents", "tools", "text"].join(",");
  const lines = t.flatMap((c) => c.messages.map((m) => [c.id, c.created_at, c.locale, c.client ?? "", m.at, m.role, m.kind, m.engine, m.intents.join("|"), m.tools.map((x) => `${x.tool}:${x.ok ? "ok" : "no"}`).join("|"), m.content].map(cell).join(",")));
  return "﻿" + [head, ...lines].join("\n");
}

export const logAccess = (db: Db, tenantId: string, action: string, target?: string) => audit(db, tenantId, "platform", action, target);
