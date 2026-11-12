import { notFound } from "next/navigation";
import OwnerShell from "@/components/OwnerShell";
import { getDb, one } from "@/lib/db";
import { formatLocal, localParts } from "@/lib/tz";
import { cancelAppt, rescheduleAppt, setApptStatus } from "../../actions";
import { STATUS } from "@/lib/owner-ui";
export const dynamic = "force-dynamic";

const MSG: Record<string, [boolean, string]> = {
  saved: [true, "Статус обновлён"], cancelled: [true, "Запись отменена, время освобождено"], moved: [true, "Запись перенесена"],
  bad_time: [false, "Проверьте дату и время"], taken: [false, "Это время занято другой записью"], error: [false, "Не удалось выполнить действие"],
};

export default async function Appointment({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string; back?: string }> }) {
  const { id } = await params; const { m, back: rawBack } = await searchParams;
  const back = rawBack && /^\/owner\/[A-Za-z0-9\/?=&%._-]*$/.test(rawBack) ? rawBack : "/owner/appointments";
  const backName = back.startsWith("/owner/today") ? "Обзор" : back.startsWith("/owner/clients") ? "Клиент" : back.startsWith("/owner/search") ? "Поиск" : "Все записи";
  return (
    <OwnerShell current="appointments">
      {async (t) => {
        if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
        const db = await getDb();
        // Всегда фильтруем по салону владельца
        const a = await one<{ id: string; status: string; start_at: string; end_at: string; created_at: string; source: Record<string, string>; delivery: string; client_id: string; name: string; contact: string; title_i18n: Record<string, string>; duration_min: number }>(db,
          `SELECT a.id,a.status,a.start_at,a.end_at,a.created_at,a.source,a.confirmation_delivery_status delivery,c.id client_id,c.name,c.contact,s.title_i18n,s.duration_min
           FROM appointments a JOIN clients c ON c.id=a.client_id JOIN services s ON s.id=a.service_id WHERE a.id=?1 AND a.tenant_id=?2`, [id, t.id]);
        if (!a) notFound();
        const st = STATUS[a.status] ?? [a.status, ""];
        const lp = localParts(new Date(a.start_at).getTime());
        const day = `${lp.y}-${String(lp.mo).padStart(2, "0")}-${String(lp.d).padStart(2, "0")}`, time = `${String(lp.h).padStart(2, "0")}:${String(lp.mi).padStart(2, "0")}`;
        const open = ["confirmed", "requested"].includes(a.status);
        const msg = m ? MSG[m] : undefined;
        return (<>
          <p><a href={back}>← {backName}</a></p>
          <h1>{a.name}</h1>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
          <section className="panel">
            <dl className="facts-list">
              <div><dt>Статус</dt><dd>{a.source.test && <span className="badge">ТЕСТ</span>} <span className={`badge ${st[1]}`}>{st[0]}</span></dd></div>
              <div><dt>Когда</dt><dd>{formatLocal(new Date(a.start_at).getTime(), "ru")} (Дублин), {a.duration_min} мин</dd></div>
              <div><dt>Услуга</dt><dd>{a.title_i18n.ru}</dd></div>
              <div><dt>Контакт</dt><dd>{a.contact}</dd></div>
              <div><dt>Источник</dt><dd>{a.source.utm_source ?? a.source.channel ?? "прямой заход"}{a.source.utm_campaign ? ` / ${a.source.utm_campaign}` : ""}</dd></div>
              <div><dt>Создана</dt><dd>{formatLocal(new Date(a.created_at).getTime(), "ru")}</dd></div>
              <div><dt>Письмо клиенту</dt><dd>{a.delivery === "not_configured" ? "почта ещё не подключена, письмо не отправлялось" : a.delivery}</dd></div>
            </dl>
            <p><a className="link-ul" href={`/owner/clients/${a.client_id}`}>Карточка клиента и все его записи</a></p>
          </section>
          {open && (
            <section className="panel">
              <h2>Действия</h2>
              <div className="row" style={{ marginTop: 0 }}>
                {a.status === "requested" && <form action={setApptStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="confirmed" /><button className="btn btn-primary" type="submit">Подтвердить</button></form>}
                {a.status === "confirmed" && <form action={setApptStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="completed" /><button className="btn btn-secondary" type="submit">Визит состоялся</button></form>}
                {a.status === "confirmed" && <form action={setApptStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><input type="hidden" name="status" value="no_show" /><button className="btn btn-secondary" type="submit">Клиент не пришёл</button></form>}
                <form action={cancelAppt}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} /><button className="btn btn-secondary" type="submit">Отменить запись</button></form>
              </div>
              <h2 style={{ marginTop: 22 }}>Перенести на любое время</h2>
              <form action={rescheduleAppt} className="sched-set">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="back" value={back} />
                <label className="field"><span>Дата</span><input type="date" name="day" defaultValue={day} required /></label>
                <label className="field"><span>Время (любые минуты)</span><input type="time" name="time" defaultValue={time} required /></label>
                <div className="row"><button className="btn btn-primary" type="submit">Перенести</button></div>
              </form>
              <p className="hint">Рабочие часы при переносе не проверяются, пересечение с другой записью невозможно. Клиент увидит новое время по своей ссылке управления записью.</p>
            </section>
          )}
        </>);
      }}
    </OwnerShell>
  );
}
