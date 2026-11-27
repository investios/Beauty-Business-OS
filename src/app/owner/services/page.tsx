import OwnerShell from "@/components/OwnerShell";
import { getDb } from "@/lib/db";
import { listAllServices, type ServiceRow } from "@/lib/service-catalog";
import { saveServiceAction } from "../actions";
export const dynamic = "force-dynamic";

const MSG: Record<string, [boolean, string]> = { ok: [true, "Сохранено. Услуга сразу доступна в записи на сайте и в календаре"], bad: [false, "Заполните название и длительность (от 15 до 600 минут)"], price: [false, "Цена должна быть числом больше нуля, например 80 или 80,50"] };
const eur = (c: number | null) => (c == null ? "" : String(c / 100));

function Form({ s }: { s?: ServiceRow }) {
  return (
    <form action={saveServiceAction} className="sched-set" style={{ display: "grid", gap: 12 }}>
      {s && <input type="hidden" name="id" value={s.id} />}
      <label className="field"><span>Название (русский)</span><input name="title_ru" defaultValue={s?.title_i18n.ru ?? ""} maxLength={80} required /></label>
      <label className="field"><span>Название (English), если пусто — покажем русское</span><input name="title_en" defaultValue={s && s.title_i18n.en !== s.title_i18n.ru ? s.title_i18n.en : ""} maxLength={80} lang="en" /></label>
      <label className="field"><span>Название (українська), если пусто — покажем русское</span><input name="title_uk" defaultValue={s && s.title_i18n.uk !== s.title_i18n.ru ? s.title_i18n.uk : ""} maxLength={80} lang="uk" /></label>
      <label className="field"><span>Описание для клиента (русский)</span><textarea name="desc_ru" rows={3} defaultValue={s?.desc_i18n.ru ?? ""} maxLength={400} /></label>
      <label className="field"><span>Описание (English)</span><textarea name="desc_en" rows={2} defaultValue={s && s.desc_i18n.en !== s.desc_i18n.ru ? s.desc_i18n.en : ""} maxLength={400} lang="en" /></label>
      <label className="field"><span>Опис (українська)</span><textarea name="desc_uk" rows={2} defaultValue={s && s.desc_i18n.uk !== s.desc_i18n.ru ? s.desc_i18n.uk : ""} maxLength={400} lang="uk" /></label>
      <label className="field"><span>Длительность (минут)</span><input name="duration" type="number" min={15} max={600} step={5} inputMode="numeric" defaultValue={s?.duration_min ?? 60} required /></label>
      <label className="field"><span>Как показывать цену</span>
        <select name="price_mode" defaultValue={s?.price_mode === "range" ? "from" : s?.price_mode ?? "unconfirmed"}>
          <option value="unconfirmed">Цена не показывается (обсуждается лично)</option>
          <option value="from">«от» указанной суммы</option>
          <option value="fixed">Точная цена</option>
        </select></label>
      <label className="field"><span>Цена, €</span><input name="price" inputMode="decimal" defaultValue={eur(s?.price_from_cents ?? null)} placeholder="например 80" /></label>
      <label className="check"><input type="checkbox" name="active" defaultChecked={s ? s.active : true} /> <span>Услуга доступна для записи</span></label>
      <div className="row"><button className="btn btn-primary" type="submit">{s ? "Сохранить" : "Добавить услугу"}</button></div>
    </form>
  );
}

export default async function Services({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const m = (await searchParams).m;
  return (
    <OwnerShell current="services">
      {async (t) => {
        const list = await listAllServices(await getDb(), t.id);
        const msg = m ? MSG[m] : null;
        return (
          <>
            <h1>Услуги</h1>
            <p className="hint">Здесь вы сами задаёте, что клиенты могут заказать: название, описание, длительность и цену. Услуга сразу появляется в записи на сайте и в календаре, а консультант называет только те цены, которые вы здесь указали. Пакетов пока нет: каждая запись на одну услугу.</p>
            {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
            <section><h2>Ваши услуги</h2>
              <div className="list">{list.map((s) => (
                <details key={s.id}>
                  <summary>{s.title_i18n.ru} · {s.duration_min} мин{s.price_from_cents != null && s.price_mode !== "unconfirmed" ? ` · ${s.price_mode === "from" ? "от " : ""}${s.price_from_cents / 100} €` : ""}{s.active ? "" : " · скрыта"}{s.is_placeholder ? " · пример" : ""}</summary>
                  <div style={{ padding: "0 16px 16px" }}><Form s={s} /></div>
                </details>))}</div>
            </section>
            <section><details><summary>Добавить новую услугу</summary><div style={{ padding: "0 16px 16px" }}><Form /></div></details></section>
          </>
        );
      }}
    </OwnerShell>
  );
}
