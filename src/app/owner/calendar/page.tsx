import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { getAvailability } from "@/lib/booking";
import { STATUS } from "@/lib/owner-ui";
import { addLocalDays, localParts, zonedToUtc } from "@/lib/tz";
import { apptsInRange, isView, parseYmd, shiftAnchor, sickLeavePreview, todayYmd, viewRange, ymdKey, type CalAppt, type View } from "@/lib/calendar";
import { ABSENCE_DRAFT, parseAbsence } from "@/lib/owner-assistant";
import { addWaitlist, setWaitlistStatus } from "../actions";
export const dynamic = "force-dynamic";

const VIEWS: [View, string][] = [["day", "День"], ["week", "Неделя"], ["month", "Месяц"]];
const MON = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MON_G = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MSG: Record<string, [boolean, string]> = {
  wl_added: [true, "Клиент добавлен в лист ожидания. Сообщение ему не отправлялось."], wl_saved: [true, "Статус обновлён"],
  wl_bad: [false, "Проверьте форму: имя, контакт, даты и согласие клиента обязательны"], wl_migration: [false, "Лист ожидания ещё не включён в базе: нужно применить миграцию 0005 (инструкция в разделе «Расписание»)"],
};
const WL_STATUS: Record<string, string> = { waiting: "ждёт", offered: "предложено время", booked: "записан", removed: "убран" };
const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const sod = (x: { y: number; mo: number; d: number }) => new Date((zonedToUtc(x.y, x.mo, x.d, 0, 0) as { utcMs: number }).utcMs);
const longDay = (y: { y: number; mo: number; d: number }) => `${y.d} ${MON_G[y.mo - 1]} ${y.y}`;
const q = (view: View, a: { y: number; mo: number; d: number }) => `/owner/calendar?view=${view}&date=${ymdKey(a)}`;

function Chip({ a }: { a: CalAppt }) {
  const [label, variant] = STATUS[a.status] ?? [a.status, ""];
  return (
    <a className={`oc-appt ${variant}`} href={`/owner/appointments/${a.id}?back=${encodeURIComponent("/owner/calendar")}`}>
      <b>{hm(a.start_at)}–{hm(a.end_at)}</b> <span>{a.name}{a.test ? " (ТЕСТ)" : ""}</span> <small>{a.title_i18n.ru ?? a.title_i18n.en} · {label}</small>
    </a>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; m?: string; from?: string; to?: string; q?: string }> }) {
  const sp = await searchParams;
  return (
    <OwnerShell current="calendar">
      {async (t) => {
        const db = await getDb();
        const now = Date.now();
        const today = todayYmd(now);
        const view: View = isView(sp.view) ? sp.view : "week";
        const anchor = parseYmd(sp.date) ?? today;
        const { first, days } = viewRange(view, anchor);
        const byDay = await apptsInRange(db, t.id, first, days);
        const cells = Array.from({ length: days }, (_, i) => addLocalDays(first.y, first.mo, first.d, i));
        const title = view === "month" ? `${MON[anchor.mo - 1][0].toUpperCase()}${MON[anchor.mo - 1].slice(1)} ${anchor.y}` : view === "day" ? longDay(anchor) : `${longDay(cells[0])} – ${longDay(cells[6])}`;
        const services = await rows<{ id: string; title_i18n: Record<string, string> }>(db, "SELECT id,title_i18n FROM services WHERE tenant_id=?1 AND active=1 ORDER BY duration_min", [t.id]);

        // Свободное время считает ТА ЖЕ функция, что и сайт с ИИ: кабинет показывает ровно то, что видят клиенты
        const freeByDay = new Map<string, number>();
        let dayFree: { id: string; title: string; slots: string[] }[] = [];
        if (services.length) {
          const probe = services[0];
          const all = await getAvailability(db, { tenantId: t.id, serviceId: probe.id, from: sod(first), days: days });
          for (const s of all) { const k = ymdKey(localParts(new Date(s.startUtc).getTime())); freeByDay.set(k, (freeByDay.get(k) ?? 0) + 1); }
          if (view === "day") {
            const k = ymdKey(anchor);
            dayFree = [];
            for (const sv of services) {
              const av = await getAvailability(db, { tenantId: t.id, serviceId: sv.id, from: sod(anchor), days: 0 });
              dayFree.push({ id: sv.id, title: sv.title_i18n.ru ?? sv.title_i18n.en, slots: av.filter((s) => ymdKey(localParts(new Date(s.startUtc).getTime())) === k).map((s) => hm(s.startUtc)) });
            }
          }
        }

        // Больничный: только просмотр затронутых записей
        const said = sp.q ? parseAbsence(sp.q.slice(0, 300), now) : null;
        const sf = said?.ok ? said.from : parseYmd(sp.from), st = said?.ok ? said.to : parseYmd(sp.to);
        const sick = sf && st ? await sickLeavePreview(db, t.id, sf, st) : null;

        let wl: { id: string; service_id: string; client_name: string; contact: string; day_from: string; day_to: string; note: string | null; status: string; title_i18n: Record<string, string> }[] = [];
        const wlFree = new Map<string, number>();
        try {
          wl = await rows(db, "SELECT w.id,w.service_id,w.client_name,w.contact,w.day_from,w.day_to,w.note,w.status,s.title_i18n FROM waitlist w JOIN services s ON s.id=w.service_id WHERE w.tenant_id=?1 AND w.status IN ('waiting','offered') ORDER BY w.created_at", [t.id]);
          for (const w of wl) {
            const f = parseYmd(w.day_from)!, to = parseYmd(w.day_to)!;
            const span = Math.min(62, Math.round((Date.UTC(to.y, to.mo - 1, to.d) - Date.UTC(f.y, f.mo - 1, f.d)) / 86400000) + 1);
            const av = await getAvailability(db, { tenantId: t.id, serviceId: w.service_id, from: sod(f), days: span - 1 });
            wlFree.set(w.id, av.filter((s) => { const k = ymdKey(localParts(new Date(s.startUtc).getTime())); return k >= w.day_from && k <= w.day_to; }).length);
          }
        } catch { /* таблицы ещё нет */ }
        const msg = sp.m ? MSG[sp.m] : undefined;
        const prev = shiftAnchor(view, anchor, -1), next = shiftAnchor(view, anchor, 1);

        return (<>
          <h1>Календарь</h1>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
          <section className="panel">
            <div className="oc-bar">
              <div className="chips">
                {VIEWS.map(([v, l]) => <a key={v} href={q(v, anchor)} aria-current={view === v ? "true" : undefined}>{l}</a>)}
              </div>
              <div className="oc-nav">
                <a className="btn btn-secondary btn-sm" href={q(view, prev)} aria-label="Назад">←</a>
                <a className="btn btn-secondary btn-sm" href={q(view, today)}>Сегодня</a>
                <a className="btn btn-secondary btn-sm" href={q(view, next)} aria-label="Вперёд">→</a>
              </div>
            </div>
            <h2 className="oc-title">{title}</h2>
            <p className="hint" style={{ marginTop: 0 }}>Показаны подтверждённые, ждущие подтверждения и состоявшиеся записи. «Свободно» считает та же функция, что показывает время клиентам на сайте и ИИ-ассистенту, для первой услуги в списке. Время по Дублину.</p>

            {view === "month" && (
              <div className="oc-month" role="table" aria-label={`Месяц: ${title}`}>
                <div role="row" className="oc-head">{WD.map((d) => <span key={d} role="columnheader">{d}</span>)}</div>
                {Array.from({ length: days / 7 }, (_, w) => (
                  <div role="row" className="oc-weekrow" key={w}>
                    {cells.slice(w * 7, w * 7 + 7).map((c) => {
                      const k = ymdKey(c), n = byDay.get(k)?.length ?? 0, free = freeByDay.get(k) ?? 0;
                      return (
                        <a role="cell" key={k} href={q("day", c)} className={`oc-cell${c.mo !== anchor.mo ? " out" : ""}${k === ymdKey(today) ? " today" : ""}`} aria-label={`${longDay(c)}: записей ${n}, свободно ${free}`}>
                          <b>{c.d}</b>
                          {n > 0 && <span className="oc-n">{n} зап.</span>}
                          {free > 0 && <small>{free} св.</small>}
                        </a>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {view === "week" && (
              <div className="oc-week">
                {cells.map((c, i) => {
                  const k = ymdKey(c), list = byDay.get(k) ?? [], free = freeByDay.get(k) ?? 0;
                  return (
                    <section key={k} className={`oc-col${k === ymdKey(today) ? " today" : ""}`} aria-label={`${WD[i]} ${c.d}`}>
                      <h3><a href={q("day", c)}>{WD[i]} {c.d}.{String(c.mo).padStart(2, "0")}</a></h3>
                      {list.length === 0 && <p className="hint">Записей нет</p>}
                      {list.map((a) => <Chip key={a.id} a={a} />)}
                      {free > 0 && <small className="hint">Свободно окон: {free}</small>}
                    </section>
                  );
                })}
              </div>
            )}

            {view === "day" && (
              <div>
                {(byDay.get(ymdKey(anchor)) ?? []).length === 0 ? <p className="hint">На этот день записей нет.</p> : <div className="oc-day">{(byDay.get(ymdKey(anchor)) ?? []).map((a) => <Chip key={a.id} a={a} />)}</div>}
                <h3>Свободное время (то, что видят клиенты)</h3>
                {dayFree.map((s) => <p key={s.id}><b>{s.title}:</b> {s.slots.length ? s.slots.join(", ") : "свободных окон нет"}</p>)}
              </div>
            )}
          </section>

          <section className="panel" id="sick">
            <h2>Больничный: кого это затронет</h2>
            <p className="hint" style={{ marginTop: 0 }}>Выберите дни, когда вас не будет, и посмотрите, какие записи попадают в этот период. Это только просмотр: записи не меняются, клиентам ничего не отправляется.</p>
            <form method="get" action="/owner/calendar#sick" className="sched-set">
              <input type="hidden" name="view" value={view} />
              <label className="field"><span>Или скажите помощнику своими словами</span><input type="text" name="q" defaultValue={sp.q ?? ""} maxLength={300} placeholder="Например: я заболела с 15 по 17 декабря" autoComplete="off" /></label>
              <div className="row"><button className="btn btn-primary" type="submit">Понять и показать</button></div>
            </form>
            {said && (said.ok
              ? <p role="status">Поняла так: <b>{said.understood}</b>. Если это не то, поправьте фразу или выберите даты ниже.</p>
              : <p className="msg-error" role="status">{said.ask}</p>)}
            <form method="get" action="/owner/calendar#sick" className="sched-set">
              <input type="hidden" name="view" value={view} />
              <label className="field"><span>С даты</span><input type="date" name="from" defaultValue={sp.from ?? ""} required /></label>
              <label className="field"><span>По дату</span><input type="date" name="to" defaultValue={sp.to ?? ""} required /></label>
              <div className="row"><button className="btn btn-secondary" type="submit">Показать затронутые записи</button></div>
            </form>
            {sick && (sick.days === 0 ? <p className="msg-error" role="status">Проверьте даты: период от 1 до 62 дней.</p> : (
              <div role="status">
                <p><b>{sick.total === 0 ? "Записей в этот период нет" : `Затронуто записей: ${sick.total}`}</b>. Ничего не изменено.</p>
                {[...sick.byDay].map(([k, list]) => <div key={k}><h3>{k}</h3>{list.map((a) => <Chip key={a.id} a={a} />)}</div>)}
                {sick.total > 0 && (
                  <details>
                    <summary><b>Черновик сообщения клиентам</b> (не отправляется)</summary>
                    <p className="hint">Подставьте имя и дату. Отправку и перенос записей вы делаете сами: помощник ничего не меняет. Автоматическая рассылка подключится вместе с почтой.</p>
                    {(["ru", "en", "uk"] as const).map((l) => <pre className="msg-pre" key={l}>{`[${l.toUpperCase()}] ${ABSENCE_DRAFT[l]}`}</pre>)}
                  </details>
                )}
              </div>
            ))}
          </section>

          <section className="panel" id="waitlist">
            <h2>Лист ожидания</h2>
            <p className="hint" style={{ marginTop: 0 }}>Клиенты, которым нужно время в другие даты. Рядом видно, сколько свободных окон сейчас есть в их периоде. Сообщения клиентам пока не отправляются: отправку подключим вместе с почтой.</p>
            {wl.length === 0 ? <p className="hint">Лист пуст.</p> : (
              <ul className="sched-list">
                {wl.map((w) => (
                  <li key={w.id}>
                    <span><b>{w.client_name}</b> · {w.contact} · {w.title_i18n.ru ?? w.title_i18n.en} · {w.day_from} – {w.day_to} · <i>{WL_STATUS[w.status]}</i> · свободных окон в периоде: <b>{wlFree.get(w.id) ?? 0}</b>{w.note ? ` · ${w.note}` : ""}</span>
                    <span className="row">
                      {(["booked", "removed"] as const).map((s) => (
                        <form key={s} action={setWaitlistStatus}><input type="hidden" name="id" value={w.id} /><input type="hidden" name="status" value={s} /><button className="btn btn-secondary btn-sm" type="submit">{s === "booked" ? "Записан" : "Убрать"}</button></form>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <h3>Добавить в лист</h3>
            <form action={addWaitlist} className="sched-set">
              <label className="field"><span>Услуга</span><select name="service" required>{services.map((s) => <option key={s.id} value={s.id}>{s.title_i18n.ru ?? s.title_i18n.en}</option>)}</select></label>
              <label className="field"><span>Имя</span><input type="text" name="name" required maxLength={100} autoComplete="off" /></label>
              <label className="field"><span>E-mail или телефон</span><input type="text" name="contact" required maxLength={120} autoComplete="off" /></label>
              <label className="field"><span>Удобно с даты</span><input type="date" name="from" required /></label>
              <label className="field"><span>По дату</span><input type="date" name="to" required /></label>
              <label className="field"><span>Заметка</span><input type="text" name="note" maxLength={200} /></label>
              <label className="check"><input type="checkbox" name="consent" value="1" /><span>Клиент согласен, что мы свяжемся с ним, когда появится время</span></label>
              <div className="row"><button className="btn btn-primary" type="submit">Добавить</button></div>
            </form>
          </section>
        </>);
      }}
    </OwnerShell>
  );
}
