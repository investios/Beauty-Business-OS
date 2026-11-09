import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";

export const dynamic = "force-dynamic";
type Row = { id: string; start_at: string; status: string; name: string; contact: string; client_id: string; title: Record<string, string>; src: Record<string, string>; delivery: string; created_at: string };

export default function Today() {
  return (
    <OwnerShell current="today">
      {async (t) => {
        const db = await getDb();
        const appts = await rows<Row>(db, `SELECT a.id,a.start_at,a.status,c.name,c.contact,c.id client_id,s.title_i18n title,a.source src,a.confirmation_delivery_status delivery,a.created_at
          FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
          WHERE a.tenant_id=$1 AND a.status='confirmed' AND a.start_at >= now() - interval '2 hours' ORDER BY a.start_at LIMIT 60`, [t.id]);
        const handoffs = (await rows<{ n: number }>(db, "SELECT count(*)::int n FROM handoffs WHERE tenant_id=$1 AND status='open'", [t.id]))[0].n;
        const clients = (await rows<{ n: number }>(db, "SELECT count(*)::int n FROM clients WHERE tenant_id=$1", [t.id]))[0].n;
        const dayKey = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
        const groups = new Map<string, Row[]>();
        for (const a of appts) { const k = dayKey(a.start_at); groups.set(k, [...(groups.get(k) ?? []), a]); }
        return (<>
          <h1>Сегодня и ближайшие дни</h1>
          <div className="stats">
            <div className="stat"><b>{appts.length}</b><span>предстоящих записей</span></div>
            <div className="stat"><b>{handoffs}</b><span>вопросов ждут вас</span></div>
            <div className="stat"><b>{clients}</b><span>клиентов в базе</span></div>
            <div className="stat"><b>0</b><span>писем отправлено (почта не подключена)</span></div>
          </div>
          {appts.length === 0 && <p>Предстоящих записей пока нет.</p>}
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="cap">{day}</h2>
              <div className="list">
                {list.map((a) => (
                  <a key={a.id} className="item" href={`/owner/clients/${a.client_id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru").replace(/^[^,]*,?\s*/, "")} · {a.name}</span><span className="badge ok">подтверждена</span></div>
                    <small>{a.title.ru} · {a.contact}</small>
                    <small>Источник: {a.src.utm_source ?? a.src.channel ?? "прямой заход"}{a.src.utm_campaign ? ` / ${a.src.utm_campaign}` : ""}{a.delivery === "not_configured" ? " · письмо клиенту не отправлялось" : ""}</small>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </>);
      }}
    </OwnerShell>
  );
}
