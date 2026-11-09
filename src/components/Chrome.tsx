"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Key } from "@/lib/i18n";
import { captureSource } from "@/lib/client";
type Dict = Record<Key, string>;

export function AskButton({ label, className }: { label: string; className?: string }) {
  return <button type="button" className={className ?? "btn btn-secondary"} onClick={() => window.dispatchEvent(new Event("open-chat"))}>{label}</button>;
}

export function StickyBar({ locale, d }: { locale: string; d: Dict }) {
  const [on, setOn] = useState(false);
  const path = usePathname();
  const hidden = path.includes("/book") || path.includes("/manage");
  useEffect(() => {
    const f = () => setOn(window.scrollY > 520);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  if (hidden) return null;
  return (
    <div className={`sticky${on ? " on" : ""}`} aria-hidden={!on}>
      <a className="btn btn-primary" href={`/${locale}/book`} tabIndex={on ? 0 : -1}>{d.ctaBook}</a>
      <button className="btn btn-secondary" type="button" tabIndex={on ? 0 : -1} onClick={() => window.dispatchEvent(new Event("open-chat"))}>{d.ctaAsk}</button>
    </div>
  );
}

/** Запоминает источник (UTM/ref) при первом заходе на любую страницу, чтобы он дожил до записи */
export function SourceCapture() {
  useEffect(() => { captureSource(); }, []);
  return null;
}
