import OwnerShell from "@/components/OwnerShell";
import { getDb } from "@/lib/db";
import { masterSummary } from "@/lib/master-summary";
export const dynamic = "force-dynamic";

const pc = (v: number | null) => (v === null ? "—" : `${v}%`);
export default async function Summary({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 90;
  return (
    <OwnerShell current="summary">
      {async (t) => {
        const s = await masterSummary(await getDb(), t.id, Date.now(), days);
        const max = Math.max(1, ...s.months.map((m) => m.n));
        return (
          <>
            <h1>Итоги</h1>
            <p className="hint">Общие цифры вашего дела за период. Их можно скачать в таблицу и посмотреть спокойно.</p>
            <nav aria-label="Период" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
              {[[30, "30 дней"], [90, "3 месяца"], [365, "Год"]].map(([d, l]) => <a key={d} className={d === days ? "btn btn-primary" : "btn"} style={{ minHeight: 40, padding: "6px 14px" }} href={`/owner/summary?days=${d}`} aria-current={d === days ? "page" : undefined}>{l}</a>)}
              <a className="btn" style={{ minHeight: 40, padding: "6px 14px" }} href={`/owner/summary/export?days=${days}`}>Скачать таблицу</a>
            </nav>
            <section className="panel"><h2>Клиентская база</h2>
              <div className="stats">
                <div className="stat"><b>{s.clientsTotal}</b><span>клиентов всего</span></div>
                <div className="stat"><b>{s.clientsNew}</b><span>новых за период</span></div>
                <div className="stat"><b>{s.growthPct === null ? "—" : `${s.growthPct > 0 ? "+" : ""}${s.growthPct}%`}</b><span>к прошлому такому же периоду ({s.clientsPrev})</span></div>
                <div className="stat"><b>{pc(s.repeatPct)}</b><span>клиентов вернулись</span></div>
              </div>
              {s.months.length > 0 && (<><h3>Новые клиенты по месяцам</h3>
                <ul className="plain">{s.months.map((m) => <li key={m.m} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}><span style={{ width: 70, flex: "none" }}>{m.m}</span><span aria-hidden style={{ display: "inline-block", height: 14, borderRadius: 4, background: "currentColor", opacity: 0.55, width: `${Math.max(4, Math.round((m.n / max) * 100))}%`, maxWidth: "60%" }} /><b>{m.n}</b></li>)}</ul></>)}
            </section>
            <section className="panel"><h2>Визиты</h2>
              <div className="stats">
                <div className="stat"><b>{s.completed}</b><span>состоялось</span></div>
                <div className="stat"><b>{s.upcoming}</b><span>впереди</span></div>
                <div className="stat"><b>{s.cancelled}</b><span>отменено</span></div>
                <div className="stat"><b>{s.noShow}</b><span>не пришли</span></div>
              </div>
            </section>
            <section className="panel"><h2>Какие услуги выбирают</h2>
              {s.services.length === 0 ? <p>За период состоявшихся визитов пока нет.</p> : <ul className="plain">{s.services.map((x) => <li key={x.title} style={{ marginBottom: 6 }}>{x.title}: <b>{x.n}</b></li>)}</ul>}
            </section>
          </>
        );
      }}
    </OwnerShell>
  );
}
