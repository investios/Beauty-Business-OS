import OwnerShell from "@/components/OwnerShell";
import { getDb, rows } from "@/lib/db";
import { POLICY_DEFS, POLICY_KEYS, getPolicies, policyHistory } from "@/lib/policies";
import { savePolicies, setBufferAll, saveTenantProfile } from "../actions";
import { getServiceRebook } from "@/lib/service-rebook";
import { saveServiceRebookAction } from "../actions";
import { getProfile, TONES } from "@/lib/tenant-profile";
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Dublin", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const fmtVal = (k: string, v: string) => { const d = POLICY_DEFS[k as keyof typeof POLICY_DEFS]; if (!d) return v; return d.kind === "bool" ? (v === "1" ? "включено" : "выключено") : `${v} ${d.unit ?? ""}`; };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <OwnerShell current="settings">
      {async (t) => {
        const db = await getDb();
        const pol = await getPolicies(db, t.id);
        const prof = await getProfile(db, t.id);
        const hist = await policyHistory(db, t.id, 20);
        const svcs = await rows<{ id: string; title_i18n: Record<string, string> | string }>(db, "SELECT id,title_i18n FROM services WHERE tenant_id=?1 AND active=1 ORDER BY title_i18n", [t.id]);
        const perSvc = await getServiceRebook(db, t.id);
        const bufs = await rows<{ buffer_min: number; n: number }>(db, "SELECT buffer_min, COUNT(*) AS n FROM services WHERE tenant_id=?1 AND active=1 GROUP BY buffer_min", [t.id]);
        const msg: [boolean, string] | undefined =
          sp.m === "saved" ? [true, Number(sp.n) ? `Сохранено изменений: ${sp.n}. Действует для новых записей; уже созданные сохраняют условия, на которые клиент согласился.` : "Изменений нет."]
          : sp.m === "buffer" ? [true, `Пауза между клиентами: ${sp.n} мин для всех услуг.`]
          : sp.m === "profile" ? [true, "Профиль сохранён. Тексты ассистента и сценариев теперь используют это имя."]
          : sp.m === "profile_bad" ? [false, "Укажите имя мастера."]
          : sp.m === "profile_migration" ? [false, "Профиль ещё не включён в базе: нужно применить миграцию 0017."]
          : sp.m === "migration" ? [false, "Правила ещё не включены в базе: нужно применить миграцию 0009."] : undefined;
        return (<>
          <h1>Настройки</h1>
          <p className="hint">Правила салона. Значения по умолчанию взяты из технического задания; меняйте под себя. Каждое изменение сохраняется в историю.</p>
          {msg && <p className={msg[0] ? "msg-ok" : "msg-error"} role="status">{msg[1]}</p>}
          {!pol.persisted && <section className="panel warnbox"><h2>Нужна миграция 0009</h2><p>Пока она не применена, показаны значения по умолчанию и сохранить изменения нельзя.</p></section>}
          <section className="panel">
            <h2>Профиль мастера</h2>
            <p className="hint">Как ассистент и тексты называют вас и вашу студию. Меняется здесь, а не в программе.</p>
            <form action={saveTenantProfile} className="sched-set">
              <label className="field"><span>Имя мастера (как к вам обращаются клиенты)</span><input name="masterName" defaultValue={prof.masterName} required maxLength={40} /></label>
              <label className="field"><span>Имя латиницей (для английских текстов)</span><input name="masterNameLatin" defaultValue={prof.masterNameLatin} maxLength={40} /></label>
              <label className="field"><span>Название студии</span><input name="studioName" defaultValue={prof.studioName} maxLength={80} /></label>
              <label className="field"><span>Город</span><input name="city" defaultValue={prof.city} maxLength={60} /></label>
              <label className="field"><span>Обращение к клиенту</span><select name="addressForm" defaultValue={prof.addressForm}><option value="vy">на «вы»</option><option value="ty">на «ты»</option></select></label>
              <label className="field"><span>Тон общения</span><select name="tone" defaultValue={prof.tone}>{Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="field"><span>О вас в нескольких словах (чем вы отличаетесь, что для вас важно; ассистент опирается на это)</span><textarea name="about" defaultValue={prof.about} maxLength={600} rows={4} /></label>
              <details><summary>Имя в падежах (если программа склонила неверно)</summary>
                <label className="field"><span>Родительный (нет кого?)</span><input name="form_gen" defaultValue={prof.forms.gen ?? ""} maxLength={40} /></label>
                <label className="field"><span>Дательный (сказать кому?)</span><input name="form_dat" defaultValue={prof.forms.dat ?? ""} maxLength={40} /></label>
                <label className="field"><span>Винительный (вижу кого?)</span><input name="form_acc" defaultValue={prof.forms.acc ?? ""} maxLength={40} /></label>
                <label className="field"><span>Творительный (доволен кем?)</span><input name="form_ins" defaultValue={prof.forms.ins ?? ""} maxLength={40} /></label>
              </details>
              <div className="row"><button className="btn btn-primary" type="submit">Сохранить профиль</button></div>
            </form>
          </section>
          <section className="panel">
            <h2>Отмены, напоминания, повторные визиты</h2>
            <form action={savePolicies} className="sched-set">
              {POLICY_KEYS.map((k) => {
                const d = POLICY_DEFS[k], v = pol.values[k];
                return d.kind === "bool"
                  ? <label className="check" key={k}><input type="checkbox" name={k} defaultChecked={v === 1} /><span><b>{d.label}</b><br /><small className="hint">{d.hint}</small></span></label>
                  : <label className="field" key={k}><span>{d.label} ({d.unit})</span><input type="number" name={k} defaultValue={v} min={d.min} max={d.max} step={1} inputMode="numeric" /><small className="hint">{d.hint}</small></label>;
              })}
              <div className="row"><button className="btn btn-primary" type="submit" disabled={!pol.persisted}>Сохранить</button></div>
            </form>
          </section>
          <section className="panel">
            <h2>Повторный визит по услугам</h2>
            <p className="hint" style={{ marginTop: 0 }}>Через сколько дней после услуги предлагать записаться снова. По этому сроку же считается статус клиента («пора записаться», «давно не были»). Пустое поле: берётся общее число выше ({pol.values.rebook_after_days} дн). Например, наращивание около 90 дней, стрижка около 20. Эти числа решаете вы.</p>
            <form action={saveServiceRebookAction} className="sched-set">
              {svcs.map((s) => {
                const title = typeof s.title_i18n === "string" ? (() => { try { return JSON.parse(s.title_i18n).ru ?? s.id; } catch { return s.id; } })() : (s.title_i18n.ru ?? s.title_i18n.en ?? s.id);
                return <label className="field" key={s.id}><span>{title} (дн)</span><input type="number" name={`svc_${s.id}`} defaultValue={perSvc.get(s.id) ?? ""} placeholder={String(pol.values.rebook_after_days)} min={7} max={365} step={1} inputMode="numeric" /></label>;
              })}
              <div className="row"><button className="btn btn-primary" type="submit">Сохранить сроки</button></div>
            </form>
          </section>
          <section className="panel">
            <h2>Пауза между клиентами</h2>
            <p className="hint" style={{ marginTop: 0 }}>Сейчас: {bufs.length ? bufs.map((b) => `${b.buffer_min} мин у ${b.n} усл.`).join(", ") : "нет услуг"}. По ТЗ рекомендуется 30 минут на уборку и подготовку.</p>
            <form action={setBufferAll} className="row">
              <input type="hidden" name="min" value="30" />
              <button className="btn btn-secondary" type="submit">Поставить 30 минут для всех услуг</button>
            </form>
          </section>
          <section className="panel">
            <h2>История изменений</h2>
            {hist.length === 0 ? <p className="hint">Изменений пока не было.</p> : (
              <ul className="sched-list">{hist.map((h, i) => <li key={i}><span><b>{POLICY_DEFS[h.key as keyof typeof POLICY_DEFS]?.label ?? h.key}</b>: {fmtVal(h.key, h.value)} (версия {h.version})</span><span>{fmt(h.created_at)}</span></li>)}</ul>
            )}
          </section>
        </>);
      }}
    </OwnerShell>
  );
}
