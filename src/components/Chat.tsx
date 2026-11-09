"use client";
import { useEffect, useRef, useState } from "react";
import type { Key } from "@/lib/i18n";
import { api, captureSource, newKey } from "@/lib/client";
import { msPerWord, tokens, totalMs } from "@/lib/typing";
type Dict = Record<Key, string>;
type Slot = { startUtc: string; label: string; serviceId: string };
type Msg = { id: number; role: "bot" | "me" | "sys"; text: string; slots?: Slot[]; human?: boolean; anim?: boolean; articles?: { slug: string; title: string; href: string }[] };

const STORE = "mk-chat-v1";
const KEEP_MS = 30 * 60 * 1000;
const IDLE_MS = 60 * 1000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Показывает текст по словам; для программ чтения с экрана выдаёт сразу весь текст */
function Typed({ text }: { text: string }) {
  const parts = tokens(text);
  const [n, setN] = useState(0);
  useEffect(() => {
    const step = msPerWord(parts.length);
    const t = setInterval(() => {
      setN((k) => (k >= parts.length ? k : k + 1));
      const log = document.querySelector(".chat-log"); log?.scrollTo({ top: log.scrollHeight });
    }, step);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return <><span className="sr-only">{text}</span><span aria-hidden="true">{parts.slice(0, n).join("")}</span></>;
}

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
  const [typing, setTyping] = useState(false);
  const alive = useRef(true);
  const add = (m: Omit<Msg, "id">) => setMsgs((x) => [...x, { ...m, id: ++idRef.current }]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /** Ответ «печатается» по словам в одном пузыре, со скоростью чтения; кнопки и ссылки появляются в конце */
  async function deliver(full: string, extra: Partial<Msg> = {}) {
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm) { add({ role: "bot", text: full, ...extra }); return; }
    setTyping(true); await sleep(500);
    if (!alive.current) return;
    setTyping(false);
    const id = ++idRef.current;
    setMsgs((x) => [...x, { id, role: "bot", text: full, anim: true }]);
    await sleep(totalMs(full) + 200);
    if (!alive.current) return;
    setMsgs((x) => x.map((m) => (m.id === id ? { ...m, anim: false, ...extra } : m)));
  }

  const idleAsked = useRef(false);
  const restored = useRef(false);

  // Разговор живёт, пока открыта вкладка: переход на другую страницу сайта не сбрасывает чат
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) {
        const st = JSON.parse(raw);
        if (st.locale === locale && st.convId && Date.now() - st.last < KEEP_MS) {
          const list: Msg[] = (st.msgs || []).map((m: Msg) => ({ ...m, anim: false }));
          idRef.current = list.reduce((a, m) => Math.max(a, m.id), 0);
          setConvId(st.convId); setMsgs(list); if (st.open) setOpen(true);
        } else sessionStorage.removeItem(STORE);
      }
    } catch { /* без хранилища просто начинаем заново */ }
    restored.current = true;
  }, [locale]);
  useEffect(() => {
    if (!restored.current || !convId) return;
    try { sessionStorage.setItem(STORE, JSON.stringify({ locale, convId, open, last: Date.now(), msgs: msgs.map((m) => ({ ...m, anim: false })) })); } catch { /* ignore */ }
  }, [msgs, convId, open, locale]);

  // Тишина в открытом чате: один раз спрашиваем, остались ли вопросы
  useEffect(() => {
    if (!open || !convId || busy || typing || text) return;
    if (idleAsked.current || msgs.length === 0 || msgs[msgs.length - 1].role !== "bot") return;
    const t = setTimeout(() => { idleAsked.current = true; void deliver(d.chatIdle); }, IDLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, convId, busy, typing, text, msgs]);

  useEffect(() => {
    const h = () => { trigger.current = document.activeElement as HTMLElement; setOpen(true); };
    window.addEventListener("open-chat", h);
    return () => window.removeEventListener("open-chat", h);
  }, []);
  useEffect(() => {
    if (!open || convId) return;
    if (!restored.current) return;
    (async () => {
      try {
        const r = await fetch(api("ai/conversations"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale, source: captureSource() }) });
        if (!r.ok) throw new Error();
        const j = await r.json();
        setConvId(j.conversationId); await deliver(j.message);
      } catch { add({ role: "sys", text: d.chatError }); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, pick, typing]);
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
    setText(""); setBusy(true); idleAsked.current = false; add({ role: "me", text: v });
    try {
      const r = await fetch(api(`ai/conversations/${convId}/messages`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: v, locale }) });
      if (!r.ok) throw new Error();
      const j = await r.json();
      await deliver(j.message, { slots: j.slots, articles: j.articles });
      if (j.requiresHuman) add({ role: "sys", text: d.chatHuman, human: true });
    } catch { setTyping(false); add({ role: "sys", text: d.chatError }); }
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

  if (!open) {
    return (
      <button type="button" className="chat-fab" onClick={() => { trigger.current = document.activeElement as HTMLElement; setOpen(true); }}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
        <span>{d.chatTitle}</span>
      </button>
    );
  }
  return (
    <section className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="chat-head">
        <div><h2 id="chat-title">{d.chatTitle}</h2><small>{d.chatBadge}</small></div>
        <button type="button" onClick={close} aria-label={d.chatClose}>×</button>
      </div>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} style={{ display: "contents" }}>
            <div className={`bubble ${m.role === "me" ? "me" : m.role === "bot" ? "bot" : "sys"}`}>{m.anim ? <Typed text={m.text} /> : m.text}</div>
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
        {typing && <div className="bubble bot typing" aria-hidden="true"><i /><i /><i /></div>}
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
