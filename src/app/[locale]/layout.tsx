import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600-italic.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/500-italic.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/marck-script/400.css";
import "../globals.css";
import "../luxury.css";
import { altFor, robotsFor } from "@/lib/seo";
import { HTML_LANG, LOCALES, dictFor, isLoc, t } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";
import Chat from "@/components/Chat";
import SiteNav from "@/components/SiteNav";
import { SourceCapture, StickyBar } from "@/components/Chrome";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f4ef" };
export function generateStaticParams() { return LOCALES.map((locale) => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLoc(locale)) return {};
  return {
    title: { default: `MK Extension Studio by Mila · ${SC[locale].hero.title}`, template: "%s · MK Extension Studio by Mila" },
    description: SC[locale].hero.text,
    robots: robotsFor(true), // демо: не индексируется, пока не включён SITE_INDEXABLE=1 (см. src/lib/seo.ts)
    alternates: altFor(locale, ""),
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale);
  const c = SC[locale];
  return (
    <html lang={HTML_LANG[locale]}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <SiteNav locale={locale} />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap foot-grid">
            <div>
              <a className="wordmark" href={`/${locale}`} aria-label="MK Extension Studio by Mila"><span className="wm-mk" aria-hidden="true">MK</span><span className="wm-txt" aria-hidden="true"><b>{c.brandTop}</b><i>{c.brandSub}</i></span></a>
              <p className="foot-tag">{c.footer.tag}</p>
            </div>
            <nav aria-label={c.footer.explore}>
              <b>{c.footer.explore}</b>
              <a href={`/${locale}/services`}>{c.nav.services}</a>
              <a href={`/${locale}/library`}>{c.nav.library}</a>
              <a href={`/${locale}/about`}>{c.nav.about}</a>
              <a href={`/${locale}/contact`}>{c.nav.contact}</a>
            </nav>
            <div>
              <b>{c.footer.legal}</b>
              <a href={`/${locale}/privacy`}>{t(locale, "privacy")}</a>
              <p className="demo-note">{c.demoNote}</p>
            </div>
          </div>
        </footer>
        <SourceCapture />
        <StickyBar locale={locale} d={d} />
        <Chat locale={locale} d={d} />
      </body>
    </html>
  );
}
