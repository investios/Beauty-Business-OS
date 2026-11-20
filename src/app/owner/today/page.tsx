import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { buildBrief } from "@/lib/brief";
import { jobsReady, recentJobs } from "@/lib/jobs";
import SpeakButton from "@/components/SpeakButton";
import { runJobsNow } from "../actions";
import { ACTION_LABEL, actorLabel, APPT_FILTERS, countAppts, listAppts, recentActivity, type ApptFilter } from "@/lib/owner-queries";
export const dynamic = "force-dynamic";

const dayKey = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <OwnerShell current="today">
      {async (t) => {
        const db = await getDb();
        const now = Date.now();
        const kpis: { f: ApptFilter; n: number }[] = [];
        for (const f of ["today", "week", "new", "requested", "cancelled30"] as ApptFilter[]) kpis.push({ f, n: await countAppts(db, t.id, f, now) });
        const one = async (sql: string) => (await rows<{ n: number }>(db, sql, [t.id]))[0].n;
        const clients = await one("SELECT count(*) n FROM clients WHERE tenant_id=?1");
        const handoffs = await one("SELECT count(*) n FROM handoffs WHERE tenant_id=?1 AND status='open'");
        const next = await listAppts(db, t.id, "week", now, { limit: 30 });
        const week = kpis.find((k) => k.f === "week")!.n;
        const brief = await buildBrief(db, t.id, now);
        const jobsOk = await jobsReady(db);
        const jobs = jobsOk ? await recentJobs(db, t.id, 5) : [];
        const o = brief.open;
        const spoken = brief.visits.length ? `На ${brief.label} записей: ${brief.visits.length}. ` + brief.visits.map((v) => `${v.time}, ${v.name}, ${v.service}${v.first ? ", первый визит" : ""}`).join(". ") : `На ${brief.label} записей нет.`;
        const activity = await recentActivity(db, t.id, 10);
        const groups = new Map<string, typeof next>();
        for (const a of next) { const k = dayKey(a.start_at); groups.set(k, [...(groups.get(k) ?? []), a]); }
        const tile = (href: string, n: number, label: string, def: string) => (
          <a className="stat stat-link" href={href} key={href}><b>{n}</b><span>{label}</span><small>{def}</small></a>
        );
        return (<>
          <h1>Обзор</h1>
          {sp.m === "jobs" && <p className="msg-ok" role="status">Фоновые задачи выполнены: {sp.n}, с ошибкой: {sp.f}.</p>}
          {sp.m === "jobs_migration" && <p className="msg-error" role="status">Нужна миграция 0012 (очередь задач).</p>}
          <section className="panel" aria-labelledby="brief-h">
            <h2 id="brief-h">Сводка на {brief.label}</h2>
            {brief.visits.length === 0 ? <p className="hint">Записей нет.</p> : (
              <ul className="plain">{brief.visits.map((v, i) => <li key={i}><b>{v.time}</b> · {v.name} · {v.service}{v.first ? " · первый визит" : ""}{v.notes.length ? <><br /><small className="hint">Важно: {v.notes.join("; ")}</small></> : null}</li>)}</ul>
            )}
            <p className="hint">Ждут вас: вопросов {o.questions}, жалоб {o.complaints}, заявок без подтверждения {o.requested}, в листе ожидания {o.waitlist}, клиентов с пропущенным циклом {o.atRisk}.</p>
            <div className="row"><SpeakButton text={spoken} /></div>
            <details><summary>Фоновые задачи</summary>
              <p className="hint">Вечерняя сводка, пересчёт статусов клиентов и сообщения клиентам выполняются по расписанию. Расписание подключается отдельно (см. инструкцию), а пока можно запустить вручную.</p>
              {jobs.length > 0 && <ul className="plain">{jobs.map((j, i) => <li key={i}>{j.kind}: {j.status}{j.last_error ? ` (${j.last_error})` : ""}</li>)}</ul>}
              <form action={runJobsNow}><button className="btn btn-secondary btn-sm" type="submit">Выполнить сейчас</button></form>
            </details>
          </section>
          <div className="stats">
            {kpis.map((k) => tile(`/owner/appointments?f=${k.f}`, k.n, APPT_FILTERS[k.f].label, APPT_FILTERS[k.f].def))}
            {tile("/owner/clients", clients, "Клиентов в базе", "все клиенты салона, без дублей по контакту")}
            {tile("/owner/ai#handoffs", handoffs, "Вопросы ждут вас", "вопросы, которые ИИ передал человеку и они ещё открыты")}
          </div>
          {week === 0 && <p className="hint">На ближайшие 7 дней записей нет. Когда клиент запишется на сайте, она появится здесь. <a className="link-ul" href="/owner/schedule">Проверить расписание</a></p>}
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="cap">{day}</h2>
              <div className="list">
                {list.map((a) => (
                  <a key={a.id} className="item" href={`/owner/appointments/${a.id}?back=${encodeURIComponent("/owner/today")}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru").replace(/^[^,]*,?\s*/, "")} · {a.name}</span><span>{a.source.test && <span className="badge">ТЕСТ</span>} <span className={`badge ${a.status === "confirmed" ? "ok" : "warn"}`}>{a.status === "confirmed" ? "подтверждена" : "ждёт подтверждения"}</span></span></div>
                    <small>{a.title_i18n.ru} · {a.contact}</small>
                    <small>Источник: {a.source.utm_source ?? a.source.channel ?? "прямой заход"}{a.source.utm_campaign ? ` / ${a.source.utm_campaign}` : ""}</small>
                  </a>
                ))}
              </div>
            </section>
          ))}
          {week > 30 && <p className="hint">Показаны первые 30 из {week}. <a className="link-ul" href="/owner/appointments?f=week">Открыть все</a></p>}
          <section>
            <h2>Последние действия</h2>
            {activity.length === 0 ? <p className="hint">Пока ничего не происходило.</p> : (
              <div className="list">
                {activity.map((e) => (
                  <a key={e.id} className="item" href={e.target ? `/owner/appointments/${e.target}?back=${encodeURIComponent("/owner/today")}` : "/owner/appointments"} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="top"><span>{ACTION_LABEL[e.action] ?? e.action}</span><small>{formatLocal(new Date(e.at).getTime(), "ru")}</small></div>
                    <small>Кто: {actorLabel(e.actor)}</small>
                  </a>
                ))}
              </div>
            )}
          </section>
        </>);
      }}
    </OwnerShell>
  );
}
