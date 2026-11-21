import { redirect } from "next/navigation";
import { platformAuthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { compute } from "@/lib/consulting";
import { accessLog, aiUsage, complaintRows, jobsSummary, listTenants, logAccess, serviceStats, tenantSettings, transcripts } from "@/lib/platform";
import { formatLocal } from "@/lib/tz";
import { runConsultantEval } from "./actions";
import { EVAL_BATCH, EVAL_CASES, evalResults } from "@/lib/consultant-eval";
import PlatformLogout from "./Logout";
export const dynamic = "force-dynamic";

const TABS = [["overview", "Обзор"], ["dialogs", "Диалоги"], ["problems", "Жалобы и передачи"], ["services", "Услуги"], ["ai", "ИИ"], ["eval", "Проверка консультанта"], ["settings", "Настройки и задачи"], ["access", "Журнал доступа"]] as const;
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const fmt = (iso: string) => formatLocal(new Date(iso).getTime(), "ru");
const title = (j: string) => { try { return (JSON.parse(j) as Record<string, string>).ru ?? j; } catch { return j; } };

export default async function Platform({ searchParams }: { searchParams: Promise<{ t?: string; tab?: string; days?: string; m?: string }> }) {
  if (!(await platformAuthorized())) redirect("/platform/login");
  const sp = await searchParams;
  const db = await getDb();
  const tenants = await listTenants(db);
  const t = tenants.find((x) => x.id === sp.t) ?? tenants[0];
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "overview";
  const days = Math.min(365, Math.max(1, Number(sp.days) || 90));
  if (!t) return <main className="wrap owner-main"><p>Салонов пока нет.</p></main>;
  await logAccess(db, t.id, "platform.view", `${tab}:${days}d`);
  const href = (k: string) => `/platform?t=${t.id}&tab=${k}&days=${days}`;
  const dl = (kind: string) => `/platform/export?t=${t.id}&kind=${kind}&days=${days}`;

  return (
    <div className="owner-shell">
      <header className="owner-top"><div className="wrap"><b>Платформа · полный доступ</b><nav className="owner-nav" aria-label="Салон"><PlatformLogout /></nav></div></header>
      <main className="wrap owner-main">
        <h1>{t.name}</h1>
        <p className="hint">Здесь видно всё: тексты диалогов, жалобы, ответы мастера, настройки. Это только для владельца платформы. Мастеру и консультанту эти данные не показываются. Каждый просмотр и выгрузка записываются в журнал доступа.</p>
        <section className="panel" style={{ marginBottom: 16 }}>
          <form method="get" className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="tab" value={tab} />
            <div className="field"><label htmlFor="t">Салон</label><select id="t" name="t" style={{ minHeight: 44, maxWidth: "100%" }} defaultValue={t.id}>{tenants.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div className="field"><label htmlFor="d">Период, дней</label><input id="d" name="days" type="number" min={1} max={365} defaultValue={days} /></div>
            <button className="btn btn-primary" type="submit">Показать</button>
          </form>
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            <a className="btn" href={dl("report")}>Скачать полный отчёт (JSON)</a>{" "}
            <a className="btn" href={dl("conversations")}>Скачать диалоги (CSV)</a>
          </p>
        </section>
        <nav aria-label="Разделы" style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TABS.map(([k, l]) => <a key={k} href={href(k)} aria-current={k === tab ? "page" : undefined} className={k === tab ? "btn btn-primary" : "btn"} style={{ minHeight: 40, padding: "6px 14px" }}>{l}</a>)}
        </nav>
        {tab === "overview" && <Overview db={db} id={t.id} days={days} />}
        {tab === "dialogs" && <Dialogs db={db} id={t.id} days={days} />}
        {tab === "problems" && <Problems db={db} id={t.id} days={days} />}
        {tab === "services" && <Services db={db} id={t.id} days={days} />}
        {tab === "ai" && <Ai db={db} id={t.id} days={days} />}
        {tab === "eval" && <Eval db={db} id={t.id} days={days} m={sp.m} />}
        {tab === "settings" && <Settings db={db} id={t.id} />}
        {tab === "access" && <Access db={db} />}
      </main>
    </div>
  );
}

type P = { db: Awaited<ReturnType<typeof getDb>>; id: string; days?: number; m?: string };

async function Overview({ db, id, days }: P) {
  const a = await compute(db, id, Date.now(), days);
  return (
    <>
      <section className="panel"><h2>Сигналы</h2><ul className="plain">{a.signals.map((s) => <li key={s.key}><b>{s.text}</b><br /><small className="hint">{s.evidence}</small></li>)}</ul></section>
      <section className="panel"><h2>Сводка за {a.days} дней</h2>
        <div className="stats">
          <div className="stat"><b>{a.created}</b><span>записей создано</span></div>
          <div className="stat"><b>{a.completed}</b><span>состоялось</span></div>
          <div className="stat"><b>{pct(a.cancelPct)}</b><span>отмен</span></div>
          <div className="stat"><b>{pct(a.noShowPct)}</b><span>неявок</span></div>
          <div className="stat"><b>{a.clientsTotal}</b><span>клиентов</span></div>
          <div className="stat"><b>{pct(a.repeatPct)}</b><span>вернулись</span></div>
          <div className="stat"><b>{a.conv}</b><span>диалогов с ИИ</span></div>
          <div className="stat"><b>{pct(a.handoffPct)}</b><span>передано мастеру</span></div>
        </div>
      </section>
    </>
  );
}

async function Dialogs({ db, id, days }: P) {
  const list = await transcripts(db, id, days!, 100);
  return (
    <section className="panel"><h2>Диалоги: {list.length}</h2>
      <p className="hint">Показаны последние 100. Полный набор скачивается кнопкой «диалоги (CSV)». У каждого ответа ИИ видно, чем он дан: сценарием, моделью или мастером.</p>
      {list.length === 0 && <p>Диалогов за период нет.</p>}
      {list.map((c) => (
        <details key={c.id} style={{ marginBottom: 10 }}>
          <summary><span style={{ whiteSpace: "nowrap" }}>{fmt(c.created_at)}</span> · {c.locale} · {c.client ?? "аноним"} · сообщений: {c.messages.length}{c.handoffs.length ? ` · передача: ${c.handoffs.map((h) => h.reason).join(", ")}` : ""}</summary>
          <ul className="plain" style={{ marginTop: 8 }}>
            {c.messages.map((m, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <b>{m.role === "user" ? "Клиент" : m.kind === "master_reply" ? "Мастер" : m.kind === "disclosure" ? "Система" : "ИИ"}</b> <small className="hint">{fmt(m.at)}{m.engine ? ` · ${m.engine}` : ""}{m.intents.length ? ` · ${m.intents.join(", ")}` : ""}</small>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.content}</div>
                {m.tools.length > 0 && <small className="hint">инструменты: {m.tools.map((x) => `${x.tool}${x.ok ? "" : " ✗"}${x.detail ? ` (${x.detail})` : ""}`).join("; ")}</small>}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}

async function Problems({ db, id, days }: P) {
  const [comp, list] = await Promise.all([complaintRows(db, id, days!), transcripts(db, id, days!, 300)]);
  const hand = list.flatMap((c) => c.handoffs.map((h) => ({ ...h, conv: c.id })));
  return (
    <>
      <section className="panel"><h2>Жалобы: {comp.length}</h2>
        {comp.length === 0 ? <p>Жалоб за период нет.</p> : <ul className="plain">{comp.map((c) => <li key={c.id} style={{ marginBottom: 10 }}><b>{c.client}</b> · {fmt(c.created_at)} · {c.status === "open" ? "открыта" : "закрыта"}<div style={{ overflowWrap: "anywhere" }}>{c.body}</div>{c.resolution && <small className="hint">Решение: {c.resolution}</small>}</li>)}</ul>}
      </section>
      <section className="panel"><h2>Вопросы, переданные мастеру: {hand.length}</h2>
        {hand.length === 0 ? <p>Передач за период нет.</p> : <ul className="plain">{hand.map((h) => <li key={h.id} style={{ marginBottom: 10 }}><b>{h.reason}</b> · {fmt(h.created_at)} · {h.status === "open" ? "ждёт ответа" : "отвечено"}<div style={{ overflowWrap: "anywhere" }}>{h.summary}</div></li>)}</ul>}
      </section>
    </>
  );
}

async function Services({ db, id, days }: P) {
  const s = await serviceStats(db, id, days!);
  return (
    <section className="panel"><h2>Услуги за {days} дней</h2>
      <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Услуга</th><th>Создано</th><th>Состоялось</th><th>Отмен</th><th>Неявок</th><th>Цена</th></tr></thead>
        <tbody>{s.map((x) => <tr key={x.slug}><td>{title(x.title)}{x.active ? "" : " (выкл.)"}</td><td>{x.created}</td><td>{x.completed}</td><td>{x.cancelled}</td><td>{x.no_show}</td><td>{x.price_mode === "unconfirmed" || x.price_from_cents == null ? "не утверждена" : `€${Math.trunc(x.price_from_cents / 100)}`}</td></tr>)}</tbody></table></div>
    </section>
  );
}

async function Ai({ db, id, days }: P) {
  const u = await aiUsage(db, id, days!);
  const li = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}>{k}: {v}</li>);
  return (
    <section className="panel"><h2>Как работает ИИ</h2>
      <p>Диалогов: {u.conversations}. Ответов ИИ: {u.assistant}. Ответов мастера: {u.master}. Отказов или небезопасных ответов модели: {u.llmRefused}.</p>
      <h3>Чем даны ответы</h3><ul className="plain">{li(u.engines)}</ul>
      <h3>О чём спрашивали</h3><ul className="plain">{li(u.intents)}</ul>
      <h3>Инструменты</h3><ul className="plain">{Object.entries(u.tools).map(([k, v]) => <li key={k}>{k}: {v.n} вызовов, успешных {v.ok}</li>)}</ul>
    </section>
  );
}

async function Settings({ db, id }: P) {
  const [s, j] = await Promise.all([tenantSettings(db, id), jobsSummary(db, id)]);
  return (
    <>
      <section className="panel"><h2>Правила бизнеса</h2><ul className="plain">{s.map((x) => <li key={x.key}>{x.label}: <b>{x.value}</b>{x.isDefault ? " (по умолчанию)" : " (изменено)"}</li>)}</ul></section>
      <section className="panel"><h2>Фоновые задачи</h2>{j.length === 0 ? <p>Задач пока не было.</p> : <ul className="plain">{j.map((x, i) => <li key={i}>{x.kind}: {x.status} — {x.n}</li>)}</ul>}</section>
    </>
  );
}

async function Access({ db }: { db: P["db"] }) {
  const l = await accessLog(db, 100);
  return <section className="panel"><h2>Журнал доступа платформы</h2><ul className="plain">{l.map((x, i) => <li key={i}>{fmt(x.at)} · {x.action}{x.target ? ` · ${x.target}` : ""}</li>)}</ul></section>;
}

async function Eval({ db, id, days, m }: P) {
  const all = await evalResults(db, id, 300);
  const latestRun = all[0]?.run_id;
  const runs = [...new Set(all.map((x) => x.run_id))].slice(0, 6);
  const shown = all.filter((x) => x.run_id === latestRun).sort((a, b) => a.case_id.localeCompare(b.case_id));
  const nb = Math.ceil(EVAL_CASES.length / EVAL_BATCH);
  return (
    <>
      <section className="panel"><h2>Проверка консультанта на живых вопросах</h2>
        <p className="hint">{EVAL_CASES.length} вопросов, как их пишут клиенты: цена, возражения, подбор, знания, здоровье, запись, жалоба, попытки обойти правила. Вопросы идут настоящей модели и настоящим знаниям этого салона. Клиентских диалогов и передач мастеру не создаётся. Из рабочей среды разработчика до модели дотянуться нельзя, поэтому запускаете вы: по кнопке, частями по {EVAL_BATCH} вопросов.</p>
        {m?.startsWith("ran") && <p className="msg-ok" role="status">Часть {m.slice(3)} готова, результаты ниже.</p>}
        <form action={runConsultantEval} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="hidden" name="t" value={id} /><input type="hidden" name="days" value={days} />
          {Array.from({ length: nb }, (_, i) => <button key={i} className="btn" name="batch" value={i} type="submit">Запустить часть {i + 1} из {nb}</button>)}
        </form>
      </section>
      <section className="panel"><h2>Последний прогон</h2>
        {shown.length === 0 ? <p>Прогонов ещё не было.</p> : (
          <>
            <p className="hint">Пометки ставит код, оценку качества даёте вы. Пометка «передача мастеру» для вопросов вне знаний нормальна. «ЗАБЛОКИРОВАНО защитой» значит, что модель написала запрещённое (цену, скидку, гарантию), клиент такого не увидит.</p>
            {shown.map((x) => (
              <details key={x.case_id} style={{ marginBottom: 10 }}>
                <summary><b style={{ whiteSpace: "nowrap" }}>{x.case_id}</b> {x.question}{x.flags ? ` · ⚑ ${x.flags}` : ""}</summary>
                <p className="hint" style={{ margin: "6px 0" }}>{x.route}{x.model ? ` · ${x.model}` : ""}</p>
                <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.answer || "—"}</div>
              </details>
            ))}
          </>
        )}
        {runs.length > 1 && <p className="hint">Прошлые прогоны сохранены и входят в полный отчёт (JSON).</p>}
      </section>
    </>
  );
}
