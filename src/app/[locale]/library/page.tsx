import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";
import { ARTICLES, type Cat } from "@/lib/library";
import { ArticleCard } from "@/components/ArticleCard";

const CATS: Cat[] = ["trichology", "extensions", "recovery", "care"];
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLoc(locale)) return {};
  return { title: SC[locale].lib.indexTitle, description: SC[locale].lib.indexLead, alternates: altFor(locale, "/library"), robots: robotsFor(true) };
}
export default async function Library({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ cat?: string }> }) {
  const { locale } = await params; const { cat } = await searchParams;
  if (!isLoc(locale)) notFound();
  const l = SC[locale].lib;
  const active = CATS.find((c) => c === cat);
  const list = ARTICLES.filter((a) => !active || a.cat === active);
  return (
    <div className="pg"><div className="wrap">
      <div className="pg-head"><p className="eyebrow">{l.eyebrow}</p><h1>{l.indexTitle}</h1><p className="lead">{l.indexLead}</p></div>
      <nav className="cat-row" aria-label={l.eyebrow}>
        <a href={`/${locale}/library`} aria-current={!active ? "true" : undefined}>{l.all}</a>
        {CATS.map((c) => <a key={c} href={`/${locale}/library?cat=${c}`} aria-current={active === c ? "true" : undefined}>{l.cats[c]}</a>)}
      </nav>
      {list.length ? <div className="art-list">{list.map((a) => <ArticleCard key={a.slug} a={a} locale={locale} />)}</div> : <p>—</p>}
    </div></div>
  );
}
