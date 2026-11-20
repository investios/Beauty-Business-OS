import { redirect } from "next/navigation";
import { consultantTenant } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { compute, consultantNotes } from "@/lib/consulting";
import { formatLocal } from "@/lib/tz";
import { saveConsultantNote } from "./actions";
import ConsultantLogout from "./Logout";
export const dynamic = "force-dynamic";

const ST: Record<string, string> = { active: "активные", overdue: "просрочен цикл", at_risk: "риск ухода", lost: "потеряны", inactive: "неактивные", archived: "архив" };
const money = (n: number) => `€${Math.trunc(n / 100)}.${String(Math.abs(n) % 100).padStart(2, "0")}`;
const p = (v: number | null) => (v === null ? "нет данных" : `${v}%`);

export default async function Consultant({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const t = await consultantTenant();
  if (!t) redirect("/consultant/login");
  const m = (await searchParams).m;
  const db = await getDb();
  const a = await compute(db, t.id, Date.now());
  const notes = await consultantNotes(db, t.id);
  return (
    <div className="owner-shell">
      <header className="owner-top"><div className="wrap"><b>{t.name} · консультант</b><nav className="owner-nav" aria-label="Разделы"><ConsultantLogout /></nav></div></header>
      <main className="wrap owner-main">
        <h1>Аналитика за {a.days} дней</h1>
        <p className="hint">Только сводные цифры: без имён, контактов и текстов клиентов. Эти данные и ваши заметки владельцу не показываются.</p>
        <section className="panel"><h2>Сигналы</h2>
          <p className="hint" style={{ marginTop: 0 }}>Автоматические подсказки по числам, а не выводы. Решение остаётся за вами и мастером.</p>
          <ul className="plain">{a.signals.map((s) => <li key={s.key}><b>{s.text}</b><br /><small className="hint">{s.evidence}</small></li>)}</ul>
        </section>
        <section className="panel"><h2>Записи</h2>
          <div className="stats">
            <div className="stat"><b>{a.created}</b><span>создано записей</span></div>
            <div className="stat"><b>{a.completed}</b><span>состоялось</span></div>
            <div className="stat"><b>{p(a.cancelPct)}</b><span>отмен</span><small>от созданных</small></div>
            <div className="stat"><b>{p(a.noShowPct)}</b><span>неявок</span><small>от завершённых визитов</small></div>
            <div className="stat"><b>{a.leadDays} дн</b><span>запись заранее</span><small>в среднем</small></div>
          </div>
        </section>
        <section className="panel"><h2>Клиенты</h2>
          <div className="stats">
            <div className="stat"><b>{a.clientsTotal}</b><span>всего</span></div>
            <div className="stat"><b>{a.clientsNew}</b><span>новых за период</span></div>
            <div className="stat"><b>{p(a.repeatPct)}</b><span>вернулись</span><small>минимум 2 визита, из бывших на визите</small></div>
            <div className="stat"><b>{a.gapDays} дн</b><span>между визитами</span><small>в среднем</small></div>
          </div>
          {a.statuses.length > 0 && <p className="hint">По статусам: {a.statuses.map((s) => `${ST[s.status] ?? s.status} ${s.n}`).join(", ")}.</p>}
        </section>
        <section className="panel"><h2>Откуда приходят</h2>
          {a.sources.length === 0 ? <p className="hint">Данных пока нет.</p> : <ul className="plain">{a.sources.map((s) => <li key={s.src}>{s.src}: {s.n}</li>)}</ul>}
        </section>
        <section className="panel"><h2>ИИ-администратор</h2>
          <p>Диалогов: {a.conv}. Передано мастеру: {a.handoffTotal} ({p(a.handoffPct)}). В листе ожидания за период: {a.waitlist}.</p>
          {a.handoffs.length > 0 && <p className="hint">Причины передачи: {a.handoffs.map((h) => `${h.reason} ${h.n}`).join(", ")}.</p>}
        </section>
        <section className="panel"><h2>Лояльность</h2>
          <p>Начислено бонусов: {money(a.accrued)}, списано: {money(a.redeemed)}, награждённых приглашений: {a.referrals}. Размеры бонусов сейчас тестовые.</p>
        </section>
        <section className="panel"><h2>Ваши заметки</h2>
          {m === "saved" && <p className="msg-ok" role="status">Заметка сохранена</p>}
          {m === "bad" && <p className="msg-error" role="status">Напишите текст заметки</p>}
          {notes === null ? <p className="hint">Нужна миграция 0014 для заметок консультанта.</p> : (<>
            <form action={saveConsultantNote} className="sched-set"><label className="field"><span>Новая заметка (видите только вы)</span><textarea name="body" rows={3} maxLength={2000} required /></label><div className="row"><button className="btn btn-primary btn-sm" type="submit">Сохранить</button></div></form>
            <div className="list">{notes.map((n) => <div key={n.id} className="item"><small>{formatLocal(new Date(n.created_at).getTime(), "ru")}</small><span style={{ whiteSpace: "pre-wrap" }}>{n.body}</span></div>)}</div>
          </>)}
        </section>
      </main>
    </div>
  );
}
