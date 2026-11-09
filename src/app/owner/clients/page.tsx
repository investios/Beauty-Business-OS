import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Clients() {
  return (
    <OwnerShell current="clients">
      {async (t) => {
        const db = await getDb();
        const list = await rows<{ id: string; name: string; contact: string; preferred_locale: string; visits: number; created_from: Record<string, string> }>(db,
          `SELECT c.id,c.name,c.contact,c.preferred_locale,c.created_from,(SELECT count(*)::int FROM appointments a WHERE a.client_id=c.id AND a.status IN ('confirmed','completed')) visits
           FROM clients c WHERE c.tenant_id=$1 ORDER BY c.created_at DESC LIMIT 200`, [t.id]);
        return (<>
          <h1>Клиенты</h1>
          {list.length === 0 && <p>Клиентов пока нет.</p>}
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
