import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";

export const dynamic = "force-dynamic";
type Row = { id: string; start_at: string; status: string; name: string; contact: string; client_id: string; title_i18n: Record<string, string>; source: Record<string, string>; delivery: string; created_at: string };

export default function Today() {
  return (
    <OwnerShell current="today">
      {async (t) => {
        const db = await getDb();
        const now = Date.now();
        const dublinDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(ms));
        const todayKey = dublinDay(now);
        const horizon = new Date(now + 8 * 86400000).toISOString();
        const appts = await rows<Row>(db, `SELECT a.id,a.start_at,a.status,c.name,c.contact,c.id client_id,s.title_i18n,a.source,a.confirmation_delivery_status delivery,a.created_at
          FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id
          WHERE a.tenant_id=?1 AND a.status IN ('confirmed','requested') AND a.start_at >= ?2 AND a.start_at < ?3 ORDER BY a.start_at LIMIT 100`, [t.id, new Date(now - 3 * 3600000).toISOString(), horizon]);
        const count = async (sql: string, args: string[] = []) => (await rows<{ n: number }>(db, sql, [t.id, ...args]))[0].n;
        const pending = await count("SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status='requested' AND start_at >= ?2", [new Date(now).toISOString()]);
        const fresh = await count("SELECT count(*) n FROM appointments WHERE tenant_id=?1 AND status IN ('confirmed','requested') AND created_at >= ?2", [new Date(now - 7 * 86400000).toISOString()]);
        const handoffs = await count("SELECT count(*) n FROM handoffs WHERE tenant_id=?1 AND status='open'");
        const clients = await count("SELECT count(*) n FROM clients WHERE tenant_id=?1");
        const today = appts.filter((a) => dublinDay(new Date(a.start_at).getTime()) === todayKey);
        const dayKey = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
        const groups = new Map<string, Row[]>();
        for (const a of appts.slice(0, 30)) { const k = dayKey(a.start_at); groups.set(k, [...(groups.get(k) ?? []), a]); }
        return (<>
          <h1>Обзор</h1>
          <div className="stats">
            <div className="stat"><b>{today.length}</b><span>записей сегодня</span></div>
            <div className="stat"><b>{appts.length}</b><span>записей на 7 дней</span></div>
            <div className="stat"><b>{fresh}</b><span>новых записей за 7 дней</span></div>
            <div className="stat"><b>{pending}</b><span>ждут подтверждения</span></div>
            <div className="stat"><b>{clients}</b><span>клиентов в базе</span></div>
            <div className="stat"><b>{handoffs}</b><span>вопросов ждут вас</span></div>
          </div>
          {pending > 0 && <p><a className="link-ul" href="/owner/appointments?f=requested">Открыть записи, которые ждут подтверждения ({pending})</a></p>}
          {appts.length === 0 && <p className="hint">На ближайшие 7 дней записей нет. Когда клиент запишется на сайте, она появится здесь. <a className="link-ul" href="/owner/schedule">Проверить расписание</a></p>}
          {appts.length > 30 && <p className="hint">Показаны первые 30 из {appts.length}. <a className="link-ul" href="/owner/appointments">Все записи</a></p>}
          {[...groups.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="cap">{day}</h2>
              <div className="list">
                {list.map((a) => (
                  <a key={a.id} className="item" href={`/owner/appointments/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru").replace(/^[^,]*,?\s*/, "")} · {a.name}</span><span>{a.source.test && <span className="badge">ТЕСТ</span>} <span className={`badge ${a.status === "confirmed" ? "ok" : "warn"}`}>{a.status === "confirmed" ? "подтверждена" : "ждёт подтверждения"}</span></span></div>
                    <small>{a.title_i18n.ru} · {a.contact}</small>
                    <small>Источник: {a.source.utm_source ?? a.source.channel ?? "прямой заход"}{a.source.utm_campaign ? ` / ${a.source.utm_campaign}` : ""}{a.delivery === "not_configured" ? " · письмо клиенту не отправлялось" : ""}</small>
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
