"use client";
import { useEffect, useRef, useState } from "react";
import type { Key } from "@/lib/i18n";
import { api, captureSource, newKey } from "@/lib/client";
type Dict = Record<Key, string>;
type Slot = { startUtc: string; label: string; serviceId: string };
type Msg = { id: number; role: "bot" | "me" | "sys"; text: string; slots?: Slot[]; human?: boolean; articles?: { slug: string; title: string; href: string }[] };

export default function Chat({ locale, d }: { locale: "en" | "ru" | "uk"; d: Dict }) {
  const [open, setOpen] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", consent: false });
  const idRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef(newKey());
  const inputRef = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const add = (m: Omit<Msg, "id">) => setMsgs((x) => [...x, { ...m, id: ++idRef.current }]);

  useEffect(() => {
    const h = () => { trigger.current = document.activeElement as HTMLElement; setOpen(true); };
    window.addEventListener("open-chat", h);
    return () => window.removeEventListener("open-chat", h);
  }, []);
  useEffect(() => {
    if (!open || convId) return;
    (async () => {
      try {
        const r = await fetch(api("ai/conversations"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, source: captureSource() }) });
        if (!r.ok) throw new Error();
        const j = await r.json();
        setConvId(j.conversationId); add({ role: "bot", text: j.message });
      } catch { add({ role: "sys", text: d.chatError }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, pick]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  });
  function close() { setOpen(false); trigger.current?.focus?.(); }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || !convId || busy) return;
    setText(""); setBusy(true); add({ role: "me", text: v });
    try {
      const r = await fetch(api(`ai/conversations/${convId}/messages`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: v, locale }) });
      if (!r.ok) throw new Error();
      const j = await r.json();
      add({ role: "bot", text: j.message, slots: j.slots, articles: j.articles });
      if (j.requiresHuman) add({ role: "sys", text: d.chatHuman, human: true });
    } catch { add({ role: "sys", text: d.chatError }); }
    setBusy(false);
  }

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!pick || busy) return;
    setBusy(true);
    try {
      const r = await fetch(api("bookings"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        serviceId: pick.serviceId, startsAtUtc: pick.startUtc, idempotencyKey: keyRef.current,
        client: { name: form.name, contact: form.contact, locale }, consentService: form.consent, source: { ...captureSource(), channel: "ai-chat" },
      }) });
      const j = await r.json();
      // «Записано» показываем только после подтверждения сервером
      if (r.ok && j.status === "confirmed") {
        add({ role: "sys", text: `${d.chatBooked} ${location.origin}/${locale}/manage/${j.appointmentId}?token=${j.manageToken}` });
        setPick(null); keyRef.current = newKey();
      } else if (j?.error?.code === "slot_taken" || j?.error?.code === "slot_unavailable") {
        add({ role: "sys", text: d.errTaken }); setPick(null); keyRef.current = newKey();
      } else add({ role: "sys", text: d.chatBookFail });
    } catch { add({ role: "sys", text: d.chatBookFail }); }
    setBusy(false);
  }

  if (!open) return null;
  return (
    <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="chat-head">
        <div><h2 id="chat-title">{d.chatTitle}</h2><small>{d.chatBadge}</small></div>
        <button type="button" onClick={close} aria-label={d.chatClose}>×</button>
      </div>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "contents" }}>
            <div className={`bubble ${m.role === "me" ? "me" : m.role === "bot" ? "bot" : "sys"}`}>{m.text}</div>
            {m.articles && m.articles.length > 0 && (
              <div className="chat-slots">
                {m.articles.map((a) => <a key={a.slug} className="btn btn-secondary btn-sm" href={a.href} target="_blank" rel="noopener">{a.title}</a>)}
              </div>
            )}
            {m.slots && m.slots.length > 0 && (
              <div className="chat-slots">
                {m.slots.map((s) => <button key={s.startUtc} type="button" className="btn btn-secondary btn-sm" onClick={() => setPick(s)}>{s.label}</button>)}
              </div>
            )}
          </div>
        ))}
        {pick && (
          <form className="chat-form" onSubmit={book}>
            <b>{pick.label}</b>
            <input type="text" required placeholder={d.name} aria-label={d.name} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="text" required placeholder={d.contact} aria-label={d.contact} autoComplete="email" inputMode="email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <label className="check"><input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>{d.consentService}</span></label>
            <div className="row" style={{ marginTop: 0 }}>
              <button className="btn btn-primary btn-sm" disabled={busy || !form.consent} type="submit">{busy ? d.saving : d.confirmBtn}</button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => setPick(null)}>{d.back}</button>
            </div>
          </form>
        )}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={d.chatPlaceholder} aria-label={d.chatPlaceholder} maxLength={1000} />
        <button className="btn btn-primary" type="submit" disabled={busy || !convId}>{d.chatSend}</button>
      </form>
    </section>
  );
}
