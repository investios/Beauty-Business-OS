import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { KIND_LABEL, IS_MARKETING, PREVIEW_LINK, render, type MsgKind } from "@/lib/lifecycle-templates";
import { FOLLOWUP_AFTER_H, QUIET_FROM_H, QUIET_TO_H, REBOOK_AFTER_DAYS } from "@/lib/lifecycle";
import { localParts } from "@/lib/tz";
import { resetLifecycleSimulation, runLifecycleSimulation } from "../actions";
export const dynamic = "force-dynamic";

const KINDS: MsgKind[] = ["booking_confirmation", "reminder_24h", "followup", "rebook"];
const REASON: Record<string, string> = {
  appointment_not_active: "запись отменена или не подтверждена", appointment_missing: "запись не найдена", visit_already_started: "визит уже начался",
  contact_not_email: "у клиента не e-mail (только телефон)", no_service_consent: "нет согласия на обработку данных для записи", no_marketing_consent: "нет согласия на рекламные сообщения",
};
const ST: Record<string, string> = { queued: "ждёт срока", not_configured: "пробно: текст сформирован, не отправлен", sent: "отправлено", failed: "ошибка отправки", cancelled: "пропущено", delivered: "доставлено" };
const fmt = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const nowLocal = () => { const p = localParts(Date.now()); const z = (n: number) => String(n).padStart(2, "0"); return `${p.y}-${z(p.mo)}-${z(p.d)}T${z(p.h)}:${z(p.mi)}`; };
const MSG: Record<string, [boolean, string]> = {
  reset: [true, "Пробные сообщения возвращены в очередь. Можно проиграть сценарий заново."], bad_date: [false, "Проверьте дату и время"],
  migration: [false, "Сообщения ещё не включены в базе: нужно применить миграцию 0006 (инструкция внизу страницы)"],
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <OwnerShell current="messages">
      {async (t) => {
        const db = await getDb();
        let ready = true;
        try { await rows(db, "SELECT 1 FROM lifecycle_messages LIMIT 1"); } catch { ready = false; }
        const queue = await rows<{ id: string; kind: string; scheduled_for: string; name: string }>(db,
          `SELECT n.id,n.kind,n.scheduled_for,c.name FROM notifications n JOIN appointments a ON a.id=n.appointment_id JOIN clients c ON c.id=a.client_id
           WHERE n.tenant_id=?1 AND n.status='queued' AND n.kind IN ('reminder_24h','followup','rebook') ORDER BY n.scheduled_for LIMIT 40`, [t.id]);
        const log = ready ? await rows<{ id: string; kind: string; status: string; mode: string; subject: string | null; body: string | null; skip_reason: string | null; locale: string; processed_at: string; name: string; error: string | null }>(db,
          `SELECT n.id,n.kind,n.status,n.error,m.mode,m.subject,m.body,m.skip_reason,m.locale,m.processed_at,c.name
           FROM lifecycle_messages m JOIN notifications n ON n.id=m.notification_id JOIN appointments a ON a.id=n.appointment_id JOIN clients c ON c.id=a.client_id
           WHERE m.tenant_id=?1 ORDER BY m.processed_at DESC LIMIT 30`, [t.id]) : [];
        const msg = sp.m === "ran"
          ? [true, `Прогон выполнен: новых задач ${sp.p}, текстов сформировано ${sp.s}, пропущено ${sp.k}, ждут утра ${sp.w}. Никому ничего не отправлено.`] as [boolean, string]
          : sp.m ? MSG[sp.m] : undefined;
        const sample = { name: "Анна", salon: t.name, service: "Предварительная консультация", when: "вт, 17 нояб., 11:00", manageUrl: PREVIEW_LINK };
        return (<>
          <h1>Сообщения клиентам</h1>
          <p className="msg-ok" role="note"><b>Пробный режим.</b> Письма не отправляются: система только формирует тексты и показывает, кому, что и когда она отправила бы. Отправку включим в конце, вместе с подключением почты и утверждением текстов Милой.</p>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
          {!ready && (
            <section className="panel warnbox">
              <h2>Нужна миграция 0006</h2>
              <p>Пришлю текст в чат; её нужно вставить в D1 Console базы <b>beauty-os</b>. До этого раздел только показывает шаблоны.</p>
            </section>
          )}
          <section className="panel">
            <h2>Что и когда отправляется</h2>
            <ul className="plain">
              <li><b>Подтверждение записи</b>: сразу после записи.</li>
              <li><b>Напоминание за сутки</b>: за 24 часа до визита; снимается, если запись отменена или перенесена (после переноса ставится заново).</li>
              <li><b>Как прошёл визит</b>: через {FOLLOWUP_AFTER_H} часа после визита, когда вы отметили его «состоялась».</li>
              <li><b>Приглашение на повторный визит</b>: через {REBOOK_AFTER_DAYS} дней, только клиентам с согласием на рекламные сообщения; в письме есть «ответьте стоп».</li>
              <li><b>Тихие часы</b>: с {QUIET_FROM_H}:00 до {QUIET_TO_H}:00 по Дублину письма не уходят, ждут утра.</li>
              <li><b>Согласия</b>: без согласия на обработку данных для записи или при отзыве рекламного согласия письмо пропускается, причина видна ниже.</li>
            </ul>
          </section>

          <section className="panel" id="sim">
            <h2>Пробный прогон</h2>
            <p className="hint" style={{ marginTop: 0 }}>Выберите «сегодняшнюю» дату и время, чтобы увидеть, какие сообщения созрели к этому моменту. Так можно проиграть весь путь клиента за минуту. Это только проверка: письма не уходят.</p>
            <form action={runLifecycleSimulation} className="sched-set">
              <label className="field"><span>Считать, что сейчас (Дублин)</span><input type="datetime-local" name="at" defaultValue={nowLocal()} required /></label>
              <label className="check"><input type="checkbox" name="assume" value="1" /><span>Считать прошедшие подтверждённые визиты состоявшимися (удобно для проверки)</span></label>
              <div className="row">
                <button className="btn btn-primary" type="submit">Прогнать сценарий</button>
              </div>
            </form>
            <form action={resetLifecycleSimulation}><button className="btn btn-secondary btn-sm" type="submit">Сбросить результаты пробных прогонов</button></form>
          </section>

          <section className="panel">
            <h2>Ждут своего срока</h2>
            {queue.length === 0 ? <p className="hint">Очередь пуста.</p> : (
              <ul className="sched-list">{queue.map((q) => <li key={q.id}><span><b>{KIND_LABEL[q.kind as MsgKind]}</b> · {q.name}</span><span>{fmt(q.scheduled_for)}</span></li>)}</ul>
            )}
          </section>

          <section className="panel">
            <h2>Журнал пробных прогонов</h2>
            {log.length === 0 ? <p className="hint">Пока ничего не формировалось.</p> : (
              <ul className="sched-list">
                {log.map((l) => (
                  <li key={l.id}>
                    <details>
                      <summary><b>{KIND_LABEL[l.kind as MsgKind]}</b> · {l.name} · {l.mode === "skipped" ? `пропущено: ${REASON[l.skip_reason ?? ""] ?? l.skip_reason}` : ST[l.status] ?? l.status}{l.error && l.mode === "failed" ? ` (${l.error})` : ""} · {fmt(l.processed_at)}</summary>
                      {l.body ? <pre className="msg-pre">{`Тема: ${l.subject}\n\n${l.body}`}</pre> : <p className="hint">Текст не формировался.</p>}
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Тексты сообщений (черновики на утверждение)</h2>
            <p className="hint" style={{ marginTop: 0 }}>Тексты без цен и обещаний результата. Миле нужно их утвердить до включения отправки. Ссылка для управления записью подставляется только при настоящей отправке.</p>
            {KINDS.map((k) => (
              <details key={k}>
                <summary><b>{KIND_LABEL[k]}</b>{IS_MARKETING[k] ? " (рекламное, нужно согласие)" : ""}</summary>
                {(["ru", "en", "uk"] as const).map((l) => { const m = render(k, l, sample); return <pre className="msg-pre" key={l}>{`[${l.toUpperCase()}] Тема: ${m.subject}\n\n${m.body}`}</pre>; })}
              </details>
            ))}
          </section>

          {!ready && (
            <section className="panel">
              <h2>Как включить в базе</h2>
              <p>Миграция 0006 только добавляет одну таблицу и один индекс, ничего не меняет. Её текст я пришлю в чат.</p>
            </section>
          )}
        </>);
      }}
    </OwnerShell>
  );
}
