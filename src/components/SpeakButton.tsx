"use client";
import { useEffect, useState } from "react";
/** Озвучивание ответа голосом браузера (speechSynthesis). Без поддержки кнопка не показывается. */
export default function SpeakButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(typeof window !== "undefined" && "speechSynthesis" in window), []);
  if (!ok) return null;
  return <button type="button" className="btn btn-secondary btn-sm" onClick={() => { try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "ru-RU"; window.speechSynthesis.speak(u); } catch { /* без звука */ } }} aria-label="Озвучить ответ">Озвучить</button>;
}
