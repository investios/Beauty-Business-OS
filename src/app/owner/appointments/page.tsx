import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { STATUS } from "@/lib/owner-ui";
export const dynamic = "force-dynamic";

const FILTERS = [["upcoming", "Предстоящие"], ["requested", "Ждут подтверждения"], ["past", "Прошедшие"], ["cancelled", "Отменённые"], ["all", "Все"]] as const;
type Row = { id: string; start_at: string; status: string; name: string; contact: string; title_i18n: Record<string, string>; source: Record<string, string> };

export default async function Appointments({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const sp = await searchParams;
  const f = FILTERS.some(([k]) => k === sp.f) ? sp.f! : "upcoming";
  const q = (sp.q ?? "").trim().slice(0, 60);
  return (
    <OwnerShell current="appointments">
      {async (t) => {
        const db = await getDb();
        const now = new Date().toISOString();
        const where = { upcoming: "a.status IN ('confirmed','requested') AND a.start_at >= ?2", requested: "a.status='requested'", past: "a.status IN ('confirmed','completed','no_show') AND a.start_at < ?2", cancelled: "a.status='cancelled'", all: "a.status <> 'held' AND ?2 IS NOT NULL" }[f]!;
        const like = `%${q.replace(/[%_]/g, "")}%`;
        const list = await rows<Row>(db, `SELECT a.id,a.start_at,a.status,c.name,c.contact,s.title_i18n,a.source FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
          WHERE a.tenant_id=?1 AND ${where} AND (?3 = '' OR c.name LIKE ?4 OR c.contact LIKE ?4) ORDER BY ${f === "past" || f === "cancelled" ? "a.start_at DESC" : "a.start_at"} LIMIT 150`, [t.id, now, q, like]);
        return (<>
          <h1>Записи</h1>
          <nav className="chips" aria-label="Фильтр записей">
            {FILTERS.map(([k, l]) => <a key={k} href={`/owner/appointments?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={f === k ? "true" : undefined}>{l}</a>)}
          </nav>
          <form className="search" role="search" action="/owner/appointments"><input type="hidden" name="f" value={f} /><input type="search" name="q" defaultValue={q} placeholder="Поиск по имени, e-mail или телефону" aria-label="Поиск записей" /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
          {list.length === 0 && <p className="hint">{q ? "По запросу ничего не найдено." : "Записей в этом списке пока нет. Когда клиент запишется на сайте, она появится здесь."}</p>}
          <div className="list">
            {list.map((a) => { const st = STATUS[a.status] ?? [a.status, ""]; return (
              <a key={a.id} className="item" href={`/owner/appointments/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru")} · {a.name}</span><span>{a.source.test && <span className="badge">ТЕСТ</span>} <span className={`badge ${st[1]}`}>{st[0]}</span></span></div>
                <small>{a.title_i18n.ru} · {a.contact} · источник: {a.source.utm_source ?? a.source.channel ?? "прямой заход"}</small>
              </a>
            ); })}
          </div>
        </>);
      }}
    </OwnerShell>
  );
}
