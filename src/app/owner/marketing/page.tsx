import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { toggleAutomation } from "../actions";
export const dynamic = "force-dynamic";

const AUTO: Record<string, [string, string]> = {
  rebook: ["Следующая запись", "после визита предложит повторную запись"],
  referral: ["Приведи друга", "личная ссылка; награда только после состоявшегося первого визита друга"],
  waitlist: ["Лист ожидания", "освободившееся окно предложат тем, кто ждёт"],
  reactivation: ["Возвращение клиентов", "мягкое приглашение тем, кто давно не был, только при согласии"],
};

export default function Marketing() {
  return (
    <OwnerShell current="marketing">
      {async (t) => {
        const db = await getDb();
        const src = await rows<{ source: string; campaign: string; leads: number }>(db, `SELECT coalesce(source->>'utm_source', source->>'channel', 'прямой заход') source, coalesce(source->>'utm_campaign','—') campaign, count(*)::int leads
          FROM appointments WHERE tenant_id=$1 AND status IN ('confirmed','completed') GROUP BY 1,2 ORDER BY 3 DESC`, [t.id]);
        const conv = (await rows<{ n: number }>(db, "SELECT count(*)::int n FROM conversations WHERE tenant_id=$1", [t.id]))[0].n;
        const booked = (await rows<{ n: number }>(db, "SELECT count(*)::int n FROM appointments WHERE tenant_id=$1 AND status IN ('confirmed','completed')", [t.id]))[0].n;
        const hand = (await rows<{ n: number }>(db, "SELECT count(*)::int n FROM handoffs WHERE tenant_id=$1", [t.id]))[0].n;
        const autos = await rows<{ key: string; enabled: boolean }>(db, "SELECT key,enabled FROM automations WHERE tenant_id=$1 ORDER BY key", [t.id]);
        return (<>
          <h1>Маркетинг</h1>
          <div className="stats">
            <div className="stat"><b>{conv}</b><span>диалогов с ассистентом</span></div>
            <div className="stat"><b>{booked}</b><span>подтверждённых записей</span></div>
            <div className="stat"><b>{hand}</b><span>передано мастеру</span></div>
          </div>
          <section><h2>Откуда приходят записи</h2>
            {src.length === 0 ? <p>Данных пока нет.</p> : <div className="tbl-wrap"><table><thead><tr><th>Источник</th><th>Кампания</th><th>Записей</th></tr></thead><tbody>{src.map((r, i) => <tr key={i}><td>{r.source}</td><td>{r.campaign}</td><td>{r.leads}</td></tr>)}</tbody></table></div>}
          </section>
          <section><h2>Четыре автоматизации</h2>
            <p className="warnbox" style={{ marginBottom: 12 }}>Сейчас переключатель только сохраняет ваше решение. Реальные сообщения не отправляются: почта, SMS и мессенджеры не подключены, а согласия клиентов ещё не собираются в боевом режиме.</p>
            <div className="list">{autos.map((a) => (
              <form key={a.key} action={toggleAutomation} className="item"><input type="hidden" name="key" value={a.key} />
                <div className="top"><span>{AUTO[a.key][0]}</span><span className={`badge ${a.enabled ? "ok" : ""}`}>{a.enabled ? "включено (отправка не подключена)" : "выключено"}</span></div>
                <small>{AUTO[a.key][1]}</small>
                <div><button className="btn btn-secondary btn-sm" type="submit">{a.enabled ? "Выключить" : "Включить"}</button></div>
              </form>))}</div>
          </section>
        </>);
      }}
    </OwnerShell>
  );
}
