"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Key } from "@/lib/i18n";
import { captureSource } from "@/lib/client";
type Dict = Record<Key, string>;

export function AskButton({ label, className }: { label: string; className?: string }) {
  return <button type="button" className={className ?? "btn btn-secondary"} onClick={() => window.dispatchEvent(new Event("open-chat"))}>{label}</button>;
}

/** Нижняя панель на телефоне: всегда на виду, одна на всех страницах (кроме записи). На компьютере её заменяет плавающая кнопка чата */
export function StickyBar({ locale, d }: { locale: string; d: Dict }) {
  const path = usePathname();
  const hidden = path.includes("/book") || path.includes("/manage");
  if (hidden) return null;
  return (
    <div className="sticky on">
      <a className="btn btn-primary" href={`/${locale}/book`}>{d.ctaBook}</a>
      <button className="btn btn-secondary" type="button" onClick={() => window.dispatchEvent(new Event("open-chat"))}>{d.ctaAsk}</button>
    </div>
  );
}

/** Запоминает источник (UTM/ref) при первом заходе на любую страницу, чтобы он дожил до записи */
export function SourceCapture() {
  useEffect(() => { captureSource(); }, []);
  return null;
}
