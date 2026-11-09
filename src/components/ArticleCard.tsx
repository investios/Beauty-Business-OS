import { SC } from "@/lib/site-copy";
import { localize, type Article } from "@/lib/library";
import type { Loc } from "@/lib/i18n";

export function ArticleCard({ a, locale }: { a: Article; locale: Loc }) {
  const c = SC[locale].lib, { content } = localize(a, locale);
  return (
    <a className="art-card" href={`/${locale}/library/${a.slug}`}>
      <span className="badge-cat">{c.cats[a.cat]}</span>
      <h3>{content.title}</h3>
      <p>{content.excerpt}</p>
      <span className="meta"><span className={`badge-st${a.status === "approved" ? " ok" : ""}`}>{a.status === "approved" ? c.approvedBadge : c.draftBadge}</span><span>{a.minutes} {c.minRead}</span></span>
    </a>
  );
}
