import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
import { STATUS } from "@/lib/owner-ui";
export const dynamic = "force-dynamic";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  return (
    <OwnerShell current="search">
      {async (t) => {
        const db = await getDb();
        const like = `%${q.replace(/[%_\\]/g, "")}%`;
        const clients = q ? await rows<{ id: string; name: string; contact: string; n: number }>(db,
          "SELECT c.id,c.name,c.contact,(SELECT count(*) FROM appointments a WHERE a.client_id=c.id AND a.status<>'held') n FROM clients c WHERE c.tenant_id=?1 AND (c.name LIKE ?2 OR c.contact LIKE ?2) ORDER BY c.created_at DESC LIMIT 20", [t.id, like]) : [];
        const appts = q ? await rows<{ id: string; start_at: string; status: string; name: string; title_i18n: Record<string, string> }>(db,
          `SELECT a.id,a.start_at,a.status,c.name,s.title_i18n FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
           WHERE a.tenant_id=?1 AND a.status<>'held' AND (c.name LIKE ?2 OR c.contact LIKE ?2 OR s.title_i18n LIKE ?2) ORDER BY a.start_at DESC LIMIT 20`, [t.id, like]) : [];
        const back = `/owner/search?q=${encodeURIComponent(q)}`;
        return (<>
          <h1>Поиск</h1>
          <form className="search" role="search" action="/owner/search"><input type="search" name="q" defaultValue={q} placeholder="Имя, e-mail, телефон или услуга" aria-label="Поиск по кабинету" autoFocus /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
          {!q && <p className="hint">Введите имя, контакт или название услуги. Поиск идёт по клиентам и записям.</p>}
          {q && clients.length === 0 && appts.length === 0 && <p className="hint">Ничего не найдено по запросу «{q}».</p>}
          {clients.length > 0 && <section><h2>Клиенты ({clients.length})</h2><div className="list">
            {clients.map((c) => <a key={c.id} className="item" href={`/owner/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}><div className="top"><span>{c.name}</span><small>записей: {c.n}</small></div><small>{c.contact}</small></a>)}
          </div></section>}
          {appts.length > 0 && <section><h2>Записи ({appts.length})</h2><div className="list">
            {appts.map((a) => { const st = STATUS[a.status] ?? [a.status, ""]; return <a key={a.id} className="item" href={`/owner/appointments/${a.id}?back=${encodeURIComponent(back)}`} style={{ textDecoration: "none", color: "inherit" }}><div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru")} · {a.name}</span><span className={`badge ${st[1]}`}>{st[0]}</span></div><small>{a.title_i18n.ru}</small></a>; })}
          </div></section>}
        </>);
      }}
    </OwnerShell>
  );
}
