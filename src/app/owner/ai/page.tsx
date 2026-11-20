import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { activateVersion, approveDraft, publishVersion, replyHandoff, resolveHandoff, saveDraft, decideVip } from "../actions";
import { getPolicies } from "@/lib/policies";
import { vipRequests } from "@/lib/loyalty";
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { medical: "медицинский вопрос", out_of_knowledge: "нет утверждённого ответа", client_requested_human: "клиент просит человека", no_slots: "нет свободного времени", vip_urgent: "срочная просьба VIP-клиента", late_change: "перенос или отмена ближе лимита", change_booking: "перенос или отмена записи" };

export default async function AiPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const m = (await searchParams).m;
  return (
    <OwnerShell current="ai">
      {async (t) => {
        const db = await getDb();
        const vr = await vipRequests(db, t.id);
        const busy = (await getPolicies(db, t.id)).values.master_busy === 1;
        const hs = await rows<{ id: string; reason: string; summary: string; contact: string | null; status: string; created_at: string }>(db, "SELECT id,reason,summary,contact,status,created_at FROM handoffs WHERE tenant_id=?1 ORDER BY (status='open') DESC, created_at DESC LIMIT 30", [t.id]);
        const arts = await rows<{ id: string; key: string; locale: string; title: string; answer: string; draft_answer: string | null; approved_by: string | null }>(db, "SELECT id,key,locale,title,answer,draft_answer,approved_by FROM knowledge_articles WHERE tenant_id=?1 ORDER BY key, locale", [t.id]);
        const vs = await rows<{ version: number; approved_by: string; active: boolean; created_at: string }>(db, "SELECT version,approved_by,active,created_at FROM knowledge_versions WHERE tenant_id=?1 ORDER BY version DESC", [t.id]);
        const keys = [...new Set(arts.map((a) => a.key))];
        const drafts = arts.filter((a) => a.draft_answer).length;
        return (<>
          <h1>ИИ и вопросы</h1>
          {m === "replied" && <p className="msg-ok" role="status">Ответ отправлен в чат клиента. Если клиент закрыл чат, он увидит его при следующем открытии.</p>}
          {m === "bad" && <p className="msg-error" role="status">Напишите текст ответа</p>}
          {busy && <p className="warnbox">Включён режим «мастер занят»: ИИ предупреждает клиентов, что вы ответите позже. Выключить можно в <a href="/owner/settings">Настройках</a>.</p>}
          <section><h2>Вопросы, которые ИИ передал вам</h2>
            {hs.length === 0 && <p>Пока нет.</p>}
            <div className="list">{hs.map((h) => (
              <div key={h.id} className="item">
                <div className="top"><span>{REASON[h.reason] ?? h.reason}</span><span className={`badge ${h.status === "open" ? "warn" : "ok"}`}>{h.status === "open" ? "ждёт ответа" : "закрыто"}</span></div>
                <small>{h.summary}</small>
                <small>Контакт: {h.contact ?? "клиент пока не оставил"} · {formatLocal(new Date(h.created_at).getTime(), "ru")}</small>
                {h.status === "open" && <form action={replyHandoff} className="sched-set"><input type="hidden" name="id" value={h.id} /><label className="field"><span>Ответ клиенту в чат</span><textarea name="text" rows={2} maxLength={1500} required /></label><div className="row"><button className="btn btn-primary btn-sm" type="submit">Отправить ответ</button></div></form>}
                {h.status === "open" && <form action={resolveHandoff}><input type="hidden" name="id" value={h.id} /><button className="btn btn-secondary btn-sm" type="submit">Отметить как решённый</button></form>}
              </div>))}</div>
          </section>
          <p className="hint">Клиенты, которым ИИ не нашёл времени и которые оставили контакт, попадают в <a href="/owner/calendar#waitlist">лист ожидания в Календаре</a>.</p>
          {vr.length > 0 && <section className="panel"><h2>Срочные запросы VIP-клиентов</h2>
            <div className="list">{vr.map((r) => <div key={r.id} className="item"><div className="top"><span>{r.name}</span><span className={`badge ${r.status === "pending" ? "warn" : "ok"}`}>{r.status === "pending" ? "ждёт решения" : r.status === "approved" ? "одобрено" : "отклонено"}</span></div><small>{r.note} · {formatLocal(new Date(r.created_at).getTime(), "ru")}</small>
              {r.status === "pending" && <form action={decideVip} className="sched-set"><input type="hidden" name="id" value={r.id} /><label className="field"><span>Ответ клиенту (план)</span><input name="note" maxLength={300} /></label><div className="row"><button className="btn btn-primary btn-sm" type="submit" name="approve" value="1">Одобрить</button><button className="btn btn-secondary btn-sm" type="submit" name="approve" value="0">Отклонить</button></div></form>}</div>)}</div></section>}
          <section><h2>Что знает ИИ</h2>
            <p className="warnbox" style={{ marginBottom: 12 }}>ИИ отвечает только по опубликованной версии. Сейчас тексты — нейтральные заглушки, мастер их ещё не утвердил. Правка попадает к клиентам только после «Утвердить» и «Опубликовать версию»{drafts ? ` (черновиков: ${drafts})` : ""}.</p>
            <div className="list">{keys.map((k) => (
              <details key={k}><summary>{arts.find((a) => a.key === k)!.title} ({k})</summary>
                <div style={{ padding: "0 16px 16px", display: "grid", gap: 14 }}>
                  {arts.filter((a) => a.key === k).map((a) => (
                    <form key={a.id} action={saveDraft} style={{ display: "grid", gap: 8 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <b>{a.locale.toUpperCase()} {a.draft_answer ? <span className="badge warn">есть черновик</span> : <span className="badge ok">{a.approved_by === "DEMO placeholder" ? "заглушка" : "утверждено"}</span>}</b>
                      <textarea className="kb" name="text" defaultValue={a.draft_answer ?? a.answer} aria-label={`${k} ${a.locale}`} maxLength={2000} />
                      <div className="inline-form">
                        <button className="btn btn-secondary btn-sm" type="submit">Сохранить черновик</button>
                        {a.draft_answer && <button className="btn btn-primary btn-sm" type="submit" formAction={approveDraft}>Утвердить</button>}
                      </div>
                    </form>))}
                </div></details>))}</div>
            <form action={publishVersion} style={{ marginTop: 14 }}><button className="btn btn-primary" type="submit">Опубликовать версию</button></form>
          </section>
          <section><h2>Версии знаний</h2><div className="list">{vs.map((v) => (
            <div key={v.version} className="item"><div className="top"><span>Версия {v.version}</span><span className={`badge ${v.active ? "ok" : ""}`}>{v.active ? "действует" : "архив"}</span></div>
              <small>{v.approved_by} · {formatLocal(new Date(v.created_at).getTime(), "ru")}</small>
              {!v.active && <form action={activateVersion}><input type="hidden" name="version" value={v.version} /><button className="btn btn-secondary btn-sm" type="submit">Вернуть эту версию</button></form>}
            </div>))}</div></section>
        </>);
      }}
    </OwnerShell>
  );
}
