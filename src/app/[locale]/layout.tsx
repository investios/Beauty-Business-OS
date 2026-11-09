import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { HTML_LANG, LOCALES, LOCALE_LABEL, dictFor, isLoc, t } from "@/lib/i18n";
import Chat from "@/components/Chat";
import { SourceCapture, StickyBar } from "@/components/Chrome";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4a2d45" };
export function generateStaticParams() { return LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLoc(locale)) return {};
  return {
    title: `${t(locale, "brand")} · ${t(locale, "heroKicker")}`,
    description: t(locale, "heroText"),
    robots: { index: false, follow: false }, // демо: не индексировать до подтверждения данных мастером
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale);
  return (
    <html lang={HTML_LANG[locale]}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href={`/${locale}`} aria-label={d.brand}>{d.brand}<span className="pill">{d.demo}</span></a>
            <div className="header-actions">
              <nav className="langs" aria-label="Language">
                {LOCALES.map((l) => <a key={l} href={`/${l}`} hrefLang={HTML_LANG[l]} lang={HTML_LANG[l]} aria-current={l === locale ? "true" : undefined}>{LOCALE_LABEL[l]}</a>)}
              </nav>
              <a className="btn btn-primary btn-sm nav-book" href={`/${locale}/book`}>{d.navBook}</a>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>{d.footerDemo}</p>
            <p><a href={`/${locale}/privacy`}>{d.privacy}</a></p>
          </div>
        </footer>
        <SourceCapture />
        <StickyBar locale={locale} d={d} />
        <Chat locale={locale} d={d} />
      </body>
    </html>
  );
}
