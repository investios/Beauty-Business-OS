import { notFound } from "next/navigation";
import OwnerShell from "@/components/OwnerShell";
import { getDb, one, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { ACTION_LABEL, actorLabel } from "@/lib/owner-queries";
import { CHANNELS, CHANNEL_LABEL, NOTE_CATEGORIES, NOTE_LABEL, STATUS_HELP, STATUS_LABEL, type ClientStatus } from "@/lib/client-model";
import { closeComplaint, saveClientChannel, saveClientNote, saveClientStatus, saveComplaint, saveReview } from "../../actions";
export const dynamic = "force-dynamic";

export default async function Client({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const { id } = await params;
  const m = (await searchParams).m;
  const back = encodeURIComponent(`/owner/clients/${id}`);
  return (
    <OwnerShell current="clients">
      {async (t) => {
        if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
        const db = await getDb();
        // Всегда фильтруем по салону владельца: чужого клиента по id не открыть
        const c = await one<{ id: string; name: string; contact: string; preferred_locale: string; created_from: Record<string, string>; created_at: string }>(db, "SELECT id,name,contact,preferred_locale,created_from,created_at FROM clients WHERE id=?1 AND tenant_id=?2", [id, t.id]);
        if (!c) notFound();
        const appts = await rows<{ id: string; start_at: string; status: string; title_i18n: Record<string, string> }>(db, "SELECT a.id,a.start_at,a.status,s.title_i18n FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.client_id=?1 AND a.tenant_id=?2 ORDER BY a.start_at DESC", [c.id, t.id]);
        const consents = await rows<{ purpose: string; granted_at: string; withdrawn_at: string | null; policy_version: string }>(db, "SELECT purpose,granted_at,withdrawn_at,policy_version FROM consents WHERE client_id=?1 AND tenant_id=?2 ORDER BY granted_at DESC", [c.id, t.id]);
        const audits = await rows<{ id: string; actor: string; action: string; target: string; at: string }>(db, "SELECT e.id,e.actor,e.action,e.target,e.at FROM audit_events e WHERE e.tenant_id=?1 AND e.target IN (SELECT id FROM appointments WHERE client_id=?2 AND tenant_id=?1) ORDER BY e.at DESC LIMIT 50", [t.id, c.id]);
        type Ev = { at: string; text: string; href?: string };
        const tl: Ev[] = [
          ...appts.map((a) => ({ at: a.start_at, text: `Визит: ${a.title_i18n.ru}`, href: `/owner/appointments/${a.id}?back=${back}` })),
          ...audits.map((e) => ({ at: e.at, text: `${ACTION_LABEL[e.action] ?? e.action} (${actorLabel(e.actor)})`, href: `/owner/appointments/${e.target}?back=${back}` })),
          ...consents.flatMap((k) => [{ at: k.granted_at, text: `Согласие дано: ${k.purpose === "marketing" ? "маркетинговые сообщения" : "обработка данных для записи"}` }, ...(k.withdrawn_at ? [{ at: k.withdrawn_at, text: `Согласие отозвано: ${k.purpose === "marketing" ? "маркетинговые сообщения" : "обработка данных для записи"}` }] : [])]),
          { at: c.created_at, text: "Клиент появился в базе" },
        ].sort((x, y) => (x.at < y.at ? 1 : -1));
        let ready = true;
        let state: { status: ClientStatus; preferred_channel: string } | null = null;
        let notes: { id: string; category: string; body: string; created_at: string }[] = [];
        let complaints: { id: string; body: string; status: string; resolution: string | null; created_at: string }[] = [];
        let reviews: { id: string; rating: number; body: string; created_at: string }[] = [];
        let hist: { status: string; reason: string; changed_by: string; created_at: string }[] = [];
        try {
          state = (await rows<{ status: ClientStatus; preferred_channel: string }>(db, "SELECT status,preferred_channel FROM client_state WHERE client_id=?1 AND tenant_id=?2", [c.id, t.id]))[0] ?? null;
          notes = await rows(db, "SELECT id,category,body,created_at FROM client_notes WHERE client_id=?1 AND tenant_id=?2 ORDER BY created_at DESC LIMIT 50", [c.id, t.id]);
          complaints = await rows(db, "SELECT id,body,status,resolution,created_at FROM complaints WHERE client_id=?1 AND tenant_id=?2 ORDER BY created_at DESC LIMIT 20", [c.id, t.id]);
          reviews = await rows(db, "SELECT id,rating,body,created_at FROM reviews WHERE client_id=?1 AND tenant_id=?2 ORDER BY created_at DESC LIMIT 20", [c.id, t.id]);
          hist = await rows(db, "SELECT status,reason,changed_by,created_at FROM client_status_history WHERE client_id=?1 AND tenant_id=?2 ORDER BY created_at DESC, rowid DESC LIMIT 10", [c.id, t.id]);
        } catch { ready = false; }
        const MSG: Record<string, [boolean, string]> = { status: [true, "Статус сохранён"], channel: [true, "Канал сохранён"], note: [true, "Заметка добавлена"], complaint: [true, "Жалоба записана"], resolved: [true, "Жалоба закрыта"], review: [true, "Отзыв добавлен"], bad: [false, "Проверьте введённые данные"], migration: [false, "Нужна миграция 0010"] };
        const msg = m ? MSG[m] : undefined;
        const fmtD = (iso: string) => formatLocal(new Date(iso).getTime(), "ru");
        const STATUS: Record<string, string> = { confirmed: "подтверждена", cancelled: "отменена", completed: "состоялась", no_show: "не пришла", requested: "заявка", held: "удержание" };
        return (<>
          <h1>{c.name}</h1>
          <div className="item"><small>Контакт: {c.contact}</small><small>Язык: {c.preferred_locale.toUpperCase()} · источник: {Object.entries(c.created_from).map(([k, v]) => `${k}=${v}`).join(", ") || "прямой заход"}</small></div>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
          {!ready ? <section className="panel warnbox"><h2>Нужна миграция 0010</h2><p>Статусы, заметки, жалобы и отзывы заработают после её применения.</p></section> : (<>
          <section className="panel">
            <h2>Статус и связь</h2>
            <p>Статус: <span className="badge">{STATUS_LABEL[state?.status ?? "active"]}</span> <small className="hint">{STATUS_HELP[state?.status ?? "active"]}</small></p>
            <form action={saveClientStatus} className="sched-set">
              <input type="hidden" name="client" value={c.id} />
              <label className="field"><span>Поставить вручную</span><select name="status" defaultValue={state?.status ?? "active"}>{(Object.keys(STATUS_LABEL) as ClientStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}</select></label>
              <label className="field"><span>Причина (по желанию)</span><input name="reason" maxLength={300} /></label>
              <div className="row"><button className="btn btn-secondary btn-sm" type="submit">Сохранить статус</button></div>
            </form>
            <form action={saveClientChannel} className="sched-set">
              <input type="hidden" name="client" value={c.id} />
              <label className="field"><span>Предпочитаемый канал связи</span><select name="channel" defaultValue={state?.preferred_channel ?? "email"}>{CHANNELS.map((k) => <option key={k} value={k}>{CHANNEL_LABEL[k]}</option>)}</select></label>
              <div className="row"><button className="btn btn-secondary btn-sm" type="submit">Сохранить канал</button></div>
            </form>
            {hist.length > 0 && <details><summary>История статусов</summary><ul className="plain">{hist.map((h, i) => <li key={i}>{fmtD(h.created_at)}: {STATUS_LABEL[h.status as ClientStatus] ?? h.status} · {h.reason} ({h.changed_by === "system" ? "система" : "мастер"})</li>)}</ul></details>}
          </section>
          <section className="panel">
            <h2>Заметки</h2>
            <form action={saveClientNote} className="sched-set">
              <input type="hidden" name="client" value={c.id} />
              <label className="field"><span>Тема</span><select name="category">{NOTE_CATEGORIES.map((k) => <option key={k} value={k}>{NOTE_LABEL[k]}</option>)}</select></label>
              <label className="field"><span>Текст заметки</span><textarea name="body" rows={3} maxLength={1500} required /></label>
              <div className="row"><button className="btn btn-primary btn-sm" type="submit">Добавить заметку</button></div>
            </form>
            <div className="list">{notes.map((n) => <div key={n.id} className="item"><div className="top"><span className="badge">{NOTE_LABEL[n.category as keyof typeof NOTE_LABEL] ?? n.category}</span><small>{fmtD(n.created_at)}</small></div><small style={{ whiteSpace: "pre-wrap" }}>{n.body}</small></div>)}</div>
          </section>
          <section className="panel">
            <h2>Жалобы</h2>
            <form action={saveComplaint} className="sched-set">
              <input type="hidden" name="client" value={c.id} />
              <label className="field"><span>Что случилось</span><textarea name="body" rows={2} maxLength={2000} required /></label>
              <div className="row"><button className="btn btn-secondary btn-sm" type="submit">Записать жалобу</button></div>
            </form>
            <div className="list">{complaints.map((k) => <div key={k.id} className="item"><div className="top"><span>{k.body}</span><span className={`badge ${k.status === "open" ? "warn" : "ok"}`}>{k.status === "open" ? "открыта" : "закрыта"}</span></div><small>{fmtD(k.created_at)}{k.resolution ? ` · решение: ${k.resolution}` : ""}</small>
              {k.status === "open" && <form action={closeComplaint} className="row"><input type="hidden" name="client" value={c.id} /><input type="hidden" name="id" value={k.id} /><input name="resolution" placeholder="Как решили" aria-label="Как решили" maxLength={1000} /><button className="btn btn-secondary btn-sm" type="submit">Закрыть</button></form>}</div>)}</div>
          </section>
          <section className="panel">
            <h2>Отзывы</h2>
            <p className="hint" style={{ marginTop: 0 }}>Внутренние оценки. На сайт они не попадают: публиковать отзыв можно только с согласия клиента.</p>
            <form action={saveReview} className="sched-set">
              <input type="hidden" name="client" value={c.id} />
              <label className="field"><span>Оценка</span><select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="field"><span>Комментарий</span><input name="body" maxLength={1500} /></label>
              <div className="row"><button className="btn btn-secondary btn-sm" type="submit">Добавить отзыв</button></div>
            </form>
            <div className="list">{reviews.map((r) => <div key={r.id} className="item"><div className="top"><span>Оценка {r.rating} из 5</span><small>{fmtD(r.created_at)}</small></div>{r.body && <small>{r.body}</small>}</div>)}</div>
          </section>
          </>)}
          <section><h2>Хронология</h2><div className="list">
            {tl.map((e, i) => e.href
              ? <a key={i} className="item" href={e.href} style={{ textDecoration: "none", color: "inherit" }}><div className="top"><span>{e.text}</span><small>{formatLocal(new Date(e.at).getTime(), "ru")}</small></div></a>
              : <div key={i} className="item"><div className="top"><span>{e.text}</span><small>{formatLocal(new Date(e.at).getTime(), "ru")}</small></div></div>)}
          </div></section>
          <section><h2>Записи</h2><div className="list">
            {appts.map((a) => <a key={a.id} className="item" href={`/owner/appointments/${a.id}?back=${back}`} style={{ textDecoration: "none", color: "inherit" }}><div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru")}</span><span className={`badge ${a.status === "confirmed" ? "ok" : a.status === "cancelled" ? "warn" : ""}`}>{STATUS[a.status] ?? a.status}</span></div><small>{a.title_i18n.ru}</small></a>)}
          </div></section>
          <section><h2>Согласия</h2><div className="list">
            {consents.map((k, i) => <div key={i} className="item"><div className="top"><span>{k.purpose === "marketing" ? "Маркетинговые сообщения" : "Обработка данных для записи"}</span><span className={`badge ${k.withdrawn_at ? "warn" : "ok"}`}>{k.withdrawn_at ? "отозвано" : "дано"}</span></div><small>версия текста: {k.policy_version}</small></div>)}
          </div></section>
        </>);
      }}
    </OwnerShell>
  );
}
