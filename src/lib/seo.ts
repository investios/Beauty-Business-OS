import { LOCALES, HTML_LANG, type Loc } from "./i18n";

/** Пока сайт демонстрационный, индексирование выключено. Включается переменной SITE_INDEXABLE=1 после утверждения контента Милой. */
export const INDEXABLE = process.env.SITE_INDEXABLE === "1";
export const SITE_URL = (process.env.SITE_URL || "https://beauty-business-os.investios.workers.dev").replace(/\/$/, "");

/** canonical + hreflang для страницы (path без языка, например "/library/why-hair-falls-out" или "") */
export function altFor(locale: Loc, path: string) {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: { ...Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], `${SITE_URL}/${l}${path}`])), "x-default": `${SITE_URL}/ru${path}` },
  };
}
export const robotsFor = (indexable = true) => (INDEXABLE && indexable ? { index: true, follow: true } : { index: false, follow: false });
