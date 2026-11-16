import { SC } from "@/lib/site-copy";
import { localize, type Article } from "@/lib/library";
import type { Loc } from "@/lib/i18n";

export function ArticleCard({ a, locale, level = 3 }: { a: Article; locale: Loc; level?: 2 | 3 }) {
  const H = `h${level}` as "h2" | "h3";
  const c = SC[locale].lib, { content } = localize(a, locale);
  return (
    <a className="art-card" href={`/${locale}/library/${a.slug}`}>
      <span className="badge-cat">{c.cats[a.cat]}</span>
      <H>{content.title}</H>
      <p>{content.excerpt}</p>
      <span className="meta"><span className={`badge-st${a.status === "approved" ? " ok" : ""}`}>{a.status === "approved" ? c.approvedBadge : c.draftBadge}</span><span>{a.minutes} {c.minRead}</span></span>
    </a>
  );
}
