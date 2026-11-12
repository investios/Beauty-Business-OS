import OwnerShell from "@/components/OwnerShell";
import { getDb } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { STATUS } from "@/lib/owner-ui";
import { APPT_FILTERS, countAppts, isApptFilter, listAppts } from "@/lib/owner-queries";
export const dynamic = "force-dynamic";

const PAGE = 25;
const TABS = ["upcoming", "today", "week", "requested", "new", "past", "cancelled30", "all"] as const;

export default async function Appointments({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; p?: string }> }) {
  const sp = await searchParams;
  const f = isApptFilter(sp.f) ? sp.f : "upcoming";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Math.min(500, parseInt(sp.p ?? "1", 10) || 1));
  const qs = (o: { f?: string; p?: number }) => `?f=${o.f ?? f}${q ? `&q=${encodeURIComponent(q)}` : ""}${o.p && o.p > 1 ? `&p=${o.p}` : ""}`;
  return (
    <OwnerShell current="appointments">
      {async (t) => {
        const db = await getDb();
        const now = Date.now();
        const total = await countAppts(db, t.id, f, now, q);
        const list = await listAppts(db, t.id, f, now, { q, limit: PAGE, offset: (page - 1) * PAGE });
        const pages = Math.max(1, Math.ceil(total / PAGE));
        const here = `/owner/appointments${qs({ p: page })}`;
        return (<>
          <h1>Записи</h1>
          <nav className="chips" aria-label="Фильтр записей">
            {TABS.map((k) => <a key={k} href={`/owner/appointments${qs({ f: k })}`} aria-current={f === k ? "true" : undefined}>{APPT_FILTERS[k].label}</a>)}
          </nav>
          <form className="search" role="search" action="/owner/appointments"><input type="hidden" name="f" value={f} /><input type="search" name="q" defaultValue={q} placeholder="Поиск по имени, e-mail или телефону" aria-label="Поиск записей" /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
          <p className="hint" role="status">{APPT_FILTERS[f].label}: <b>{total}</b>. {APPT_FILTERS[f].def}{q ? `, по запросу «${q}»` : ""}.</p>
          {list.length === 0 && <p className="hint">{q ? "По запросу ничего не найдено." : "В этом списке пока ничего нет. Когда клиент запишется на сайте, запись появится здесь."}</p>}
          <div className="list">
            {list.map((a) => { const st = STATUS[a.status] ?? [a.status, ""]; return (
              <a key={a.id} className="item" href={`/owner/appointments/${a.id}?back=${encodeURIComponent(here)}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru")} · {a.name}</span><span>{a.source.test && <span className="badge">ТЕСТ</span>} <span className={`badge ${st[1]}`}>{st[0]}</span></span></div>
                <small>{a.title_i18n.ru} · {a.contact} · источник: {a.source.utm_source ?? a.source.channel ?? "прямой заход"}</small>
              </a>
            ); })}
          </div>
          {pages > 1 && (
            <nav className="chips pager" aria-label="Страницы">
              {page > 1 && <a href={`/owner/appointments${qs({ p: page - 1 })}`}>← Назад</a>}
              <span className="hint">Страница {page} из {pages}</span>
              {page < pages && <a href={`/owner/appointments${qs({ p: page + 1 })}`}>Дальше →</a>}
            </nav>
          )}
        </>);
      }}
    </OwnerShell>
  );
}
