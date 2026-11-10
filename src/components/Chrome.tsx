"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Key } from "@/lib/i18n";
import { captureSource } from "@/lib/client";
type Dict = Record<Key, string>;

export function AskButton({ label, className }: { label: string; className?: string }) {
  return <button type="button" className={className ?? "btn btn-secondary"} data-ask="" onClick={() => window.dispatchEvent(new Event("open-chat"))}>{label}</button>;
}

/**
 * Нижняя кнопка на телефоне: одна, компактная.
 * На главной появляется только после того, как кнопки первого экрана ушли вверх.
 * Прячется, когда в экране кнопка подвала, при вводе текста (клавиатура), при открытом меню и в чате.
 * На компьютере её заменяет плавающая кнопка чата.
 */
export function StickyBar({ locale, d }: { locale: string; d: Dict }) {
  const path = usePathname();
  const hidden = path.includes("/book") || path.includes("/manage");
  const [past, setPast] = useState(false), [foot, setFoot] = useState(false), [typing, setTyping] = useState(false);
  useEffect(() => {
    if (hidden) return;
    const obs: IntersectionObserver[] = [];
    const hero = document.querySelector(".lx-hero .lx-cta .m-only");
    if (hero) {
      const o = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
      o.observe(hero); obs.push(o);
    } else setPast(true); // внутренние страницы: кнопка видна сразу, чтобы спросить можно было с любой страницы
    const f = document.querySelector(".site-footer [data-ask]"); // прячемся, когда в экране появилась такая же кнопка подвала
    if (f) { const o = new IntersectionObserver(([e]) => setFoot(e.isIntersecting), { threshold: 0 }); o.observe(f); obs.push(o); }
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const on = (e: FocusEvent) => { if (isField(e.target)) setTyping(true); };
    const off = () => setTyping(false);
    document.addEventListener("focusin", on); document.addEventListener("focusout", off);
    return () => { obs.forEach((o) => o.disconnect()); document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); };
  }, [path, hidden]);
  if (hidden) return null;
  const show = past && !foot && !typing;
  return (
    <div className={`sticky${show ? " on" : ""}`}>
      <button className="btn btn-primary" type="button" data-ask="" tabIndex={show ? 0 : -1} onClick={() => window.dispatchEvent(new Event("open-chat"))}>{d.ctaAskBook}</button>
    </div>
  );
}

/** Запоминает источник (UTM/ref) при первом заходе на любую страницу, чтобы он дожил до записи */
export function SourceCapture() {
  useEffect(() => { captureSource(); }, []);
  return null;
}
