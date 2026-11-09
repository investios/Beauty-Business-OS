import { notFound } from "next/navigation";
import OwnerShell from "@/components/OwnerShell";
import { getDb, one, rows } from "@/lib/db";
import { formatLocal } from "@/lib/tz";
export const dynamic = "force-dynamic";

export default async function Client({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OwnerShell current="clients">
      {async (t) => {
        if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
        const db = await getDb();
        // Всегда фильтруем по салону владельца: чужого клиента по id не открыть
        const c = await one<{ id: string; name: string; contact: string; preferred_locale: string; created_from: Record<string, string>; created_at: string }>(db, "SELECT id,name,contact,preferred_locale,created_from,created_at FROM clients WHERE id=?1 AND tenant_id=?2", [id, t.id]);
        if (!c) notFound();
        const appts = await rows<{ id: string; start_at: string; status: string; title_i18n: Record<string, string> }>(db, "SELECT a.id,a.start_at,a.status,s.title_i18n FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.client_id=?1 AND a.tenant_id=?2 ORDER BY a.start_at DESC", [c.id, t.id]);
        const consents = await rows<{ purpose: string; granted_at: string; withdrawn_at: string | null; policy_version: string }>(db, "SELECT purpose,granted_at,withdrawn_at,policy_version FROM consents WHERE client_id=?1 AND tenant_id=?2 ORDER BY granted_at DESC", [c.id, t.id]);
        const STATUS: Record<string, string> = { confirmed: "подтверждена", cancelled: "отменена", completed: "состоялась", no_show: "не пришла", requested: "заявка", held: "удержание" };
        return (<>
          <h1>{c.name}</h1>
          <div className="item"><small>Контакт: {c.contact}</small><small>Язык: {c.preferred_locale.toUpperCase()} · источник: {Object.entries(c.created_from).map(([k, v]) => `${k}=${v}`).join(", ") || "прямой заход"}</small></div>
          <section><h2>Записи</h2><div className="list">
            {appts.map((a) => <div key={a.id} className="item"><div className="top"><span>{formatLocal(new Date(a.start_at).getTime(), "ru")}</span><span className={`badge ${a.status === "confirmed" ? "ok" : a.status === "cancelled" ? "warn" : ""}`}>{STATUS[a.status] ?? a.status}</span></div><small>{a.title_i18n.ru}</small></div>)}
          </div></section>
          <section><h2>Согласия</h2><div className="list">
            {consents.map((k, i) => <div key={i} className="item"><div className="top"><span>{k.purpose === "marketing" ? "Маркетинговые сообщения" : "Обработка данных для записи"}</span><span className={`badge ${k.withdrawn_at ? "warn" : "ok"}`}>{k.withdrawn_at ? "отозвано" : "дано"}</span></div><small>версия текста: {k.policy_version}</small></div>)}
          </div></section>
        </>);
      }}
    </OwnerShell>
  );
}
