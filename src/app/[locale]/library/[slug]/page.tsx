import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc, dictFor } from "@/lib/i18n";
import { SC, HUB_SERVICE, type HubId } from "@/lib/site-copy";
import { getArticle, localize, ARTICLES } from "@/lib/library";
import { AskButton } from "@/components/Chrome";
import { ArticleCard } from "@/components/ArticleCard";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params; const a = getArticle(slug);
  if (!isLoc(locale) || !a) return {};
  const { content } = localize(a, locale);
  return { title: content.title, description: content.excerpt, alternates: altFor(locale, `/library/${slug}`), robots: robotsFor(a.status === "approved") };
}
export default async function ArticlePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const a = getArticle(slug);
  if (!isLoc(locale) || !a) notFound();
  const c = SC[locale], l = c.lib, d = dictFor(locale);
  const { content, fallback } = localize(a, locale);
  const rel = a.related.map((s) => ARTICLES.find((x) => x.slug === s)).filter((x) => !!x);
  const hub = a.hub as HubId;
  const ld = {
    "@context": "https://schema.org", "@type": "Article", headline: content.title, description: content.excerpt, inLanguage: locale === "uk" ? "uk" : locale,
    dateModified: a.updated, author: { "@type": "Person", name: "Mila" }, publisher: { "@type": "Organization", name: "MK Extension Studio by Mila" },
    citation: a.sources.map((s) => s.url),
  };
  const faqLd = content.faq.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: content.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) } : null;
  return (
    <div className="pg"><div className="wrap">
      <article className="article">
        <p className="crumb"><a href={`/${locale}/library`}>{l.back}</a><span aria-hidden="true">/</span><span>{l.cats[a.cat]}</span></p>
        <span className="badge-cat">{l.cats[a.cat]}</span>
        <h1>{content.title}</h1>
        <p className="meta">
          <span className={`badge-st${a.status === "approved" ? " ok" : ""}`}>{a.status === "approved" ? l.approvedBadge : l.draftBadge}</span>
          <span>{a.ownerReviewed ? l.reviewed : l.notReviewed}</span><span>{a.updated}</span><span>{a.minutes} {l.minRead}</span>
        </p>
        {fallback && <p className="lang-pending">{l.langPending}</p>}
        {content.body.map((b, i) => b.t === "ul" ? <ul key={i}>{b.items.map((x) => <li key={x}>{x}</li>)}</ul> : b.t === "h2" ? <h2 key={i}>{b.text}</h2> : <p key={i}>{b.text}</p>)}
        <p className="disclaimer">{l.disclaimer}</p>
        {content.faq.length > 0 && <section><h2>{l.faq}</h2><div className="faq">{content.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div></section>}
        <section className="sources"><h2 style={{ marginTop: 0 }}>{l.sources}</h2>
          <ol>{a.sources.map((s) => <li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.title}</a>, {s.publisher}{s.year ? `, ${s.year}` : ""}</li>)}</ol>
        </section>
        <div className="pg-cta">
          <a className="btn btn-primary" href={`/${locale}/book?service=${HUB_SERVICE[hub] ?? "consultation"}`}>{d.ctaBook}</a>
          <AskButton label={c.hubLabels.ask} className="btn btn-secondary" />
        </div>
      </article>
      {rel.length > 0 && <><h2 className="sub">{l.related}</h2><div className="art-list">{rel.map((x) => <ArticleCard key={x!.slug} a={x!} locale={locale} />)}</div></>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}
    </div></div>
  );
}
