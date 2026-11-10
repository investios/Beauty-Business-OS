import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { getScheduleSettings, listExceptions } from "@/lib/booking";
import { addException, applyDefaultSchedule, deleteException, manualBooking, saveService, saveSettings, saveWeekly } from "../actions";
export const dynamic = "force-dynamic";

const DAYS = [["1", "Понедельник"], ["2", "Вторник"], ["3", "Среда"], ["4", "Четверг"], ["5", "Пятница"], ["6", "Суббота"], ["0", "Воскресенье"]] as const;
const MSG: Record<string, [boolean, string]> = {
  saved: [true, "Сохранено"], defaults: [true, "Стандартное расписание применено: пн–пт 08:00–17:00, шаг 1 час"], booked: [true, "Клиент записан"],
  bad_time: [false, "Проверьте время: конец должен быть позже начала"], bad_value: [false, "Проверьте введённые значения"],
  bad_client: [false, "Укажите имя клиента, e-mail или телефон и отметьте согласие клиента"], taken: [false, "Это время уже занято другой записью"],
  migration: [false, "Эта настройка ещё не включена в базе: нужно применить миграцию 0004 (инструкция внизу страницы)"], error: [false, "Не удалось сохранить, попробуйте ещё раз"],
};
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hhmmEnd = (m: number) => (m === 1440 ? "00:00" : hhmm(m));

export default async function Schedule({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <OwnerShell current="schedule">
      {async (t) => {
        const db = await getDb();
        const rules = await rows<{ weekday: number; start_min: number; end_min: number }>(db, "SELECT weekday,start_min,end_min FROM availability_rules WHERE tenant_id=?1 GROUP BY weekday,start_min,end_min ORDER BY weekday,start_min", [t.id]);
        const settings = await getScheduleSettings(db, t.id);
        const exc = await listExceptions(db, t.id, new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date()));
        const services = await rows<{ id: string; title_i18n: Record<string, string>; duration_min: number; buffer_min: number }>(db, "SELECT id,title_i18n,duration_min,buffer_min FROM services WHERE tenant_id=?1 AND active=1 ORDER BY duration_min", [t.id]);
        let migrated = true;
        try { await rows(db, "SELECT 1 FROM schedule_settings LIMIT 1"); await rows(db, "SELECT 1 FROM schedule_exceptions LIMIT 1"); } catch { migrated = false; }
        const msg = m ? MSG[m] : undefined;
        return (<>
          <h1>Расписание</h1>
          <p className="hint" style={{ marginTop: 0 }}>Здесь вы сами задаёте, когда принимаете клиентов. Часы и дни ничем не ограничены: хоть воскресенье, хоть 23:00. Клиенты и ИИ-ассистент видят только то, что вы здесь открыли и что не занято. Время по Дублину.</p>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}

          <section className="panel">
            <h2>Рабочие часы по дням недели</h2>
            <form action={saveWeekly} className="sched">
              {DAYS.map(([wd, name]) => {
                const r = rules.filter((x) => String(x.weekday) === wd);
                return (
                  <fieldset key={wd} className="sched-row">
                    <legend className="sr-only">{name}</legend>
                    <label className="check"><input type="checkbox" name={`on${wd}`} value="1" defaultChecked={r.length > 0} /><span><b>{name}</b></span></label>
                    <div className="sched-times">
                      {[0, 1].map((i) => (
                        <span key={i} className="sched-pair">
                          <input type="time" aria-label={`${name}: начало ${i + 1}`} name={`a${wd}_${i + 1}`} defaultValue={r[i] ? hhmm(r[i].start_min) : i === 0 ? "08:00" : ""} />
                          <span aria-hidden="true">–</span>
                          <input type="time" aria-label={`${name}: конец ${i + 1}`} name={`b${wd}_${i + 1}`} defaultValue={r[i] ? hhmmEnd(r[i].end_min) : i === 0 ? "17:00" : ""} />
                        </span>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
              <p className="hint">Второй промежуток нужен для перерыва (например, 08:00–12:00 и 13:00–17:00). Снимите галочку у дня, и он станет выходным.</p>
              <div className="row"><button className="btn btn-primary" type="submit">Сохранить часы</button></div>
            </form>
            <form action={applyDefaultSchedule}><button className="btn btn-secondary btn-sm" type="submit">Вернуть стандартное: пн–пт 08:00–17:00, шаг 1 час</button></form>
          </section>

          <section className="panel">
            <h2>Шаг слотов и ограничения записи</h2>
            <form action={saveSettings} className="sched-set">
              <label className="field"><span>Шаг начала записи, минут</span><input type="number" name="step" min={5} max={240} defaultValue={settings.stepMin} required /></label>
              <label className="field"><span>Не раньше чем через, минут (0 = без ограничения)</span><input type="number" name="notice" min={0} defaultValue={settings.minNoticeMin} required /></label>
              <label className="field"><span>Показывать клиентам вперёд, дней</span><input type="number" name="horizon" min={1} max={366} defaultValue={settings.horizonDays} required /></label>
              <div className="row"><button className="btn btn-primary" type="submit">Сохранить</button></div>
            </form>
          </section>

          <section className="panel">
            <h2>Выходные и дополнительные дни</h2>
            <form action={addException} className="sched-set">
              <label className="field"><span>Дата</span><input type="date" name="day" required /></label>
              <label className="field"><span>Что сделать</span>
                <select name="kind" defaultValue="closed"><option value="closed">Закрыть (выходной или перерыв)</option><option value="open">Открыть дополнительные часы</option></select></label>
              <label className="field"><span>С (пусто = весь день)</span><input type="time" name="from" /></label>
              <label className="field"><span>До</span><input type="time" name="to" /></label>
              <label className="field"><span>Заметка</span><input type="text" name="note" maxLength={120} /></label>
              <div className="row"><button className="btn btn-primary" type="submit">Добавить</button></div>
            </form>
            {exc.length > 0 ? (
              <ul className="sched-list">
                {exc.map((e) => (
                  <li key={e.id}>
                    <span><b>{e.day}</b> · {e.kind === "closed" ? (e.start_min == null ? "выходной весь день" : `закрыто ${hhmm(e.start_min)}–${hhmmEnd(e.end_min!)}`) : `открыто ${hhmm(e.start_min!)}–${hhmmEnd(e.end_min!)}`}{e.note ? ` · ${e.note}` : ""}</span>
                    <form action={deleteException}><input type="hidden" name="id" value={e.id} /><button className="btn btn-secondary btn-sm" type="submit">Убрать</button></form>
                  </li>
                ))}
              </ul>
            ) : <p className="hint">Исключений пока нет.</p>}
          </section>

          <section className="panel">
            <h2>Сколько длится каждая услуга</h2>
            <p className="hint" style={{ marginTop: 0 }}>Клиент записывается на выбранное время, и следующий не может начаться раньше конца услуги плюс перерыв после неё.</p>
            <ul className="sched-list">
              {services.map((s) => (
                <li key={s.id}>
                  <form action={saveService} className="sched-svc">
                    <input type="hidden" name="id" value={s.id} />
                    <b>{s.title_i18n.ru ?? s.title_i18n.en}</b>
                    <label className="field"><span>Длительность, мин</span><input type="number" name="duration" min={5} max={720} defaultValue={s.duration_min} required /></label>
                    <label className="field"><span>Перерыв после, мин</span><input type="number" name="buffer" min={0} max={240} defaultValue={s.buffer_min} required /></label>
                    <button className="btn btn-secondary btn-sm" type="submit">Сохранить</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Записать клиента вручную на любое время</h2>
            <p className="hint" style={{ marginTop: 0 }}>Любой день и минуты, например воскресенье 17:15. Рабочие часы не проверяются, двойная запись на занятое время невозможна.</p>
            <form action={manualBooking} className="sched-set">
              <label className="field"><span>Услуга</span><select name="service" required>{services.map((s) => <option key={s.id} value={s.id}>{s.title_i18n.ru ?? s.title_i18n.en} ({s.duration_min} мин)</option>)}</select></label>
              <label className="field"><span>Дата</span><input type="date" name="day" required /></label>
              <label className="field"><span>Время (любые минуты)</span><input type="time" name="time" required /></label>
              <label className="field"><span>Имя клиента</span><input type="text" name="name" required maxLength={100} autoComplete="off" /></label>
              <label className="field"><span>E-mail или телефон</span><input type="text" name="contact" required maxLength={120} autoComplete="off" /></label>
              <label className="check"><input type="checkbox" name="consent" value="1" /><span>Клиент согласен, что его контакт хранится для этой записи</span></label>
              <label className="check"><input type="checkbox" name="test" value="1" /><span>Тестовая запись (демо): будет помечена «ТЕСТ» и не считается настоящей</span></label>
              <div className="row"><button className="btn btn-primary" type="submit">Записать</button></div>
            </form>
          </section>

          {!migrated && (
            <section className="panel warnbox">
              <h2>Нужно один раз обновить базу</h2>
              <p>Рабочие часы, длительности услуг и ручная запись уже работают. Для выходных и дополнительных дней и настроек шага нужны две новые таблицы. Откройте в Cloudflare базу <b>beauty-os</b>, вкладку «Console», вставьте содержимое файла <code>migrations/0004_schedule.sql</code> из проекта и выполните. Безопасно: только добавляет таблицы и ничего не меняет.</p>
            </section>
          )}
        </>);
      }}
    </OwnerShell>
  );
}
