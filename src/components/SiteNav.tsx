"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LOCALES, LOCALE_LABEL, HTML_LANG, type Loc } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";

/** Шапка: меню, переключатель языка (сохраняет текущую страницу), кнопка записи. Мобильное меню — раскрывающаяся панель. */
export default function SiteNav({ locale }: { locale: Loc }) {
  const c = SC[locale];
  const path = usePathname() || `/${locale}`;
  const rest = path.replace(/^\/(en|ru|uk)(?=\/|$)/, "");
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { document.documentElement.dataset.menu = open ? "1" : ""; return () => { document.documentElement.dataset.menu = ""; }; }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open]);
  const items = [
    { href: `/${locale}`, label: c.nav.home, on: rest === "" },
    { href: `/${locale}/about`, label: c.nav.about, on: rest.startsWith("/about") },
    { href: `/${locale}/services`, label: c.nav.services, on: rest.startsWith("/services") },
    { href: `/${locale}/library`, label: c.nav.library, on: rest.startsWith("/library") },
    { href: `/${locale}/results`, label: c.nav.results, on: rest.startsWith("/results") },
    { href: `/${locale}/contact`, label: c.nav.contact, on: rest.startsWith("/contact") },
  ];
  return (
    <header className="site-header">
      <div className="wrap hdr">
        <a className="wordmark" href={`/${locale}`} aria-label="MK Extension Studio by Mila">
          <span className="wm-mk" aria-hidden="true">MK</span>
          <span className="wm-txt" aria-hidden="true"><b>{c.brandTop}</b><i>{c.brandSub}</i></span>
        </a>
        <nav className="mainnav" aria-label="Main">
          {items.map((i) => <a key={i.href} href={i.href} aria-current={i.on ? "page" : undefined}>{i.label}</a>)}
        </nav>
        <div className="hdr-right">
          <a className="btn btn-primary btn-sm nav-book" href={`/${locale}/book`}>{c.nav.book}</a>
          <nav className="langs" aria-label={c.nav.lang}>
            {LOCALES.map((l) => <a key={l} href={`/${l}${rest}`} hrefLang={HTML_LANG[l]} lang={HTML_LANG[l]} aria-current={l === locale ? "true" : undefined}>{LOCALE_LABEL[l]}</a>)}
          </nav>
          <button type="button" className="burger" aria-expanded={open} aria-controls="mnav" aria-label={c.nav.menu} onClick={() => setOpen(!open)}>
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      <nav id="mnav" className="mpanel" aria-label={c.nav.menu} hidden={!open}>
        <div className="wrap">
          {items.map((i) => <a key={i.href} href={i.href} aria-current={i.on ? "page" : undefined}>{i.label}</a>)}
          <a className="btn btn-primary" href={`/${locale}/book`}>{c.nav.book}</a>
        </div>
      </nav>
    </header>
  );
}
