import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return (
    <OwnerShell current="clients">
      {async (t) => {
        const db = await getDb();
        const list = await rows<{ id: string; name: string; contact: string; preferred_locale: string; visits: number; created_from: Record<string, string> }>(db,
          `SELECT c.id,c.name,c.contact,c.preferred_locale,c.created_from,(SELECT count(*) FROM appointments a WHERE a.client_id=c.id AND a.status IN ('confirmed','completed')) visits
           FROM clients c WHERE c.tenant_id=?1 AND (?2 = '' OR c.name LIKE ?3 OR c.contact LIKE ?3) ORDER BY c.created_at DESC LIMIT 200`, [t.id, q, like]);
        return (<>
          <h1>Клиенты</h1>
          <form className="search" role="search" action="/owner/clients"><input type="search" name="q" defaultValue={q} placeholder="Поиск по имени, e-mail или телефону" aria-label="Поиск клиентов" /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
          {list.length === 0 && <p className="hint">{q ? "По запросу никого не найдено." : "Клиентов пока нет. Они появятся после первой записи на сайте."}</p>}
          <div className="list">
            {list.map((c) => (
              <a key={c.id} className="item" href={`/owner/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="top"><span>{c.name}</span><span className="badge">{c.preferred_locale.toUpperCase()}</span></div>
                <small>{c.contact} · записей: {c.visits} · источник: {c.created_from.utm_source ?? c.created_from.channel ?? "прямой заход"}</small>
              </a>
            ))}
          </div>
        </>);
      }}
    </OwnerShell>
  );
}
