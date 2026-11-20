"use client";
import { useEffect, useRef, useState } from "react";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };
type Ctor = new () => Rec;

/** Голосовой ввод владельца: распознавание речи в самом браузере (на iPhone в Safari работает; запасной вариант это обычная клавиатура).
 *  Распознанный текст попадает в поле, и владелец сам отправляет форму. Голос на сервер не отправляется. */
export default function VoiceField({ name, label, placeholder, defaultValue, maxLength = 300 }: { name: string; label: string; placeholder?: string; defaultValue?: string; maxLength?: number }) {
  const [val, setVal] = useState(defaultValue ?? "");
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState("");
  const rec = useRef<Rec | null>(null);
  useEffect(() => { const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }; setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition)); }, []);
  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition; if (!C) return;
    const r = new C(); r.lang = "ru-RU"; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(" ").trim(); if (t) setVal((v) => `${v ? v + " " : ""}${t}`.slice(0, maxLength)); };
    r.onerror = (e) => setNote(e.error === "not-allowed" ? "Нет доступа к микрофону. Разрешите его в настройках браузера или печатайте." : "Не расслышала, попробуйте ещё раз или напечатайте.");
    r.onend = () => setListening(false);
    setNote(""); setListening(true); rec.current = r;
    try { r.start(); } catch { setListening(false); }
  }
  return (
    <label className="field">
      <span>{label}</span>
      <span style={{ display: "flex", gap: 8 }}>
        <input type="text" name={name} value={val} onChange={(e) => setVal(e.target.value)} maxLength={maxLength} placeholder={placeholder} autoComplete="off" style={{ flex: 1, minWidth: 0 }} />
        {supported && <button type="button" className="btn btn-secondary" onClick={toggle} aria-pressed={listening} aria-label={listening ? "Остановить запись голоса" : "Сказать голосом"}>{listening ? "Слушаю…" : "Голос"}</button>}
      </span>
      <small className="hint" aria-live="polite">{note || (supported ? "Нажмите «Голос» и скажите фразу; текст появится в поле." : "Голосовой ввод в этом браузере недоступен: печатайте.")}</small>
    </label>
  );
}
