import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { STATUS_LABEL, refreshClientStatuses, type ClientStatus } from "@/lib/client-model";
export const dynamic = "force-dynamic";
type Row = { id: string; name: string; contact: string; preferred_locale: string; visits: number; status: string | null; created_from: Record<string, string> };
export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  return (
    <OwnerShell current="clients">
      {async (t) => {
        const db = await getDb();
        await refreshClientStatuses(db, t.id);
        const sql = (st: string, join: string) => `SELECT c.id,c.name,c.contact,c.preferred_locale,c.created_from,${st} status,(SELECT count(*) FROM appointments a WHERE a.client_id=c.id AND a.status IN ('confirmed','completed')) visits
           FROM clients c ${join} WHERE c.tenant_id=?1 AND (?2 = '' OR c.name LIKE ?3 OR c.contact LIKE ?3) ORDER BY c.created_at DESC LIMIT 200`;
        const args = [t.id, q, like];
        const list = await rows<Row>(db, sql("s.status", "LEFT JOIN client_state s ON s.client_id=c.id"), args).catch(() => rows<Row>(db, sql("NULL", ""), args));
        return (<>
          <h1>Клиенты</h1>
          <form className="search" role="search" action="/owner/clients"><input type="search" name="q" defaultValue={q} placeholder="Поиск по имени, e-mail или телефону" aria-label="Поиск клиентов" /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
          {list.length === 0 && <p className="hint">{q ? "По запросу никого не найдено." : "Клиентов пока нет. Они появятся после первой записи на сайте."}</p>}
          <div className="list">
            {list.map((c) => (
              <a key={c.id} className="item" href={`/owner/clients/${c.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div className="top"><span>{c.name}</span><span className="badge">{c.status ? (STATUS_LABEL[c.status as ClientStatus] ?? c.status) : c.preferred_locale.toUpperCase()}</span></div>
                <small>{c.contact} · записей: {c.visits} · язык: {c.preferred_locale.toUpperCase()} · источник: {c.created_from.utm_source ?? c.created_from.channel ?? "прямой заход"}</small>
              </a>
            ))}
          </div>
        </>);
      }}
    </OwnerShell>
  );
}
