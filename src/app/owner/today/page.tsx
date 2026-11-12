import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { ACTION_LABEL, actorLabel, APPT_FILTERS, countAppts, listAppts, recentActivity, type ApptFilter } from "@/lib/owner-queries";
export const dynamic = "force-dynamic";

const dayKey = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

export default function Overview() {
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
        const activity = await recentActivity(db, t.id, 10);
        const groups = new Map<string, typeof next>();
        for (const a of next) { const k = dayKey(a.start_at); groups.set(k, [...(groups.get(k) ?? []), a]); }
        const tile = (href: string, n: number, label: string, def: string) => (
          <a className="stat stat-link" href={href} key={href}><b>{n}</b><span>{label}</span><small>{def}</small></a>
        );
        return (<>
          <h1>Обзор</h1>
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
