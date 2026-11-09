import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { HUBS } from "@/lib/site-copy";
import { ARTICLES } from "@/lib/library";
import { SITE_URL, INDEXABLE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!INDEXABLE) return [];
  const paths = ["", "/about", "/services", ...HUBS.map((h) => `/services/${h}`), "/library", "/results", "/contact", "/book", ...ARTICLES.filter((a) => a.status === "approved").map((a) => `/library/${a.slug}`)];
  return LOCALES.flatMap((l) => paths.map((p) => ({
    url: `${SITE_URL}/${l}${p}`,
    alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x === "uk" ? "uk" : x === "en" ? "en-IE" : "ru", `${SITE_URL}/${x}${p}`])) },
  })));
}
