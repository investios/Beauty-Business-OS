import OwnerShell from "@/components/OwnerShell";
import { getDb } from "@/lib/db";
import { approvals, CATALOG_VERSION, FAMILIES } from "@/lib/playbooks";
import { getProfile, fillProfile, profileVars } from "@/lib/tenant-profile";
import { decidePlaybook } from "../actions";
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { service: "служебное", sales: "консультация и запись", care: "забота и обратная связь", marketing: "предложение (нужно согласие клиента)" };

export default function Scripts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <OwnerShell current="marketing">
      {async (t) => {
        const sp = await searchParams;
        const db = await getDb();
        const ap = await approvals(db, t.id);
        const prof = await getProfile(db, t.id);
        const vr = profileVars(prof, "ru"), ve = profileVars(prof, "en"), vu = profileVars(prof, "uk");
        const n = FAMILIES.filter((f) => ap[f.id]?.status === "approved" && ap[f.id].version === CATALOG_VERSION).length;
        return (<>
          <h1>Сценарии общения</h1>
          {sp.m === "ok" && <p className="msg-ok" role="status">Решение сохранено.</p>}
          {!prof.configured && <p className="warnbox">Имя мастера не задано: в текстах стоит слово «мастер». Заполните профиль в «Настройках».</p>}
          <p className="warnbox">Это черновики. Они пока никуда не отправляются: ассистент и рассылки их не используют. Утверждённый здесь текст станет разрешённым для будущей отправки, но сама отправка включается отдельно и только после подключения почты. Цены, скидки и сроки в текстах не придуманы: на их месте стоят пометки в квадратных скобках. Утверждено: {n} из {FAMILIES.length}.</p>
          <div className="list">{FAMILIES.map((f) => {
            const a = ap[f.id]; const ok = a?.status === "approved" && a.version === CATALOG_VERSION;
            return (
              <details key={f.id} className="item">
                <summary><b style={{ whiteSpace: "nowrap" }}>{f.id}</b><span style={{ flex: "1 1 8rem", minWidth: 0 }}>{f.title.ru}</span> <span className={`badge ${ok ? "ok" : ""}`}>{ok ? "утверждено" : a?.status === "approved" ? "текст изменился, утвердите заново" : "черновик"}</span></summary>
                <p className="hint">{KIND[f.kind]}. Цель: {f.goal}.</p>
                <p><b>Русский.</b> {fillProfile(f.message.ru, vr)}</p>
                <p><b>English.</b> {fillProfile(f.message.en, ve)}</p>
                <p><b>Українська.</b> {fillProfile(f.message.ua, vu)}</p>
                <p className="hint"><b>Стоп-условия:</b> {f.stop_conditions.join("; ")}. <b>Как писать нельзя:</b> {f.anti_example}</p>
                <ul className="plain">{f.branches.map((b, i) => <li key={i}><b>{b.name}:</b> {fillProfile(b.reply_ru, vr)}</li>)}</ul>
                <form action={decidePlaybook} className="row"><input type="hidden" name="id" value={f.id} />
                  <button className="btn btn-secondary btn-sm" name="decision" value="approve" type="submit">Утвердить</button>
                  <button className="btn btn-secondary btn-sm" name="decision" value="revoke" type="submit">Отозвать</button></form>
              </details>);
          })}</div>
        </>);
      }}
    </OwnerShell>
  );
}
