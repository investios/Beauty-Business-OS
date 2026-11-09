import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc, dictFor } from "@/lib/i18n";
import { SC, HUBS, HUB_SERVICE, type HubId } from "@/lib/site-copy";
import { ARTICLES } from "@/lib/library";
import { AskButton } from "@/components/Chrome";
import { ArticleCard } from "@/components/ArticleCard";

const isHub = (x: string): x is HubId => (HUBS as string[]).includes(x);
export async function generateMetadata({ params }: { params: Promise<{ locale: string; hub: string }> }): Promise<Metadata> {
  const { locale, hub } = await params; if (!isLoc(locale) || !isHub(hub)) return {};
  return { title: SC[locale].hubs[hub].title, description: SC[locale].hubs[hub].lead, alternates: altFor(locale, `/services/${hub}`), robots: robotsFor(true) };
}
export default async function Hub({ params }: { params: Promise<{ locale: string; hub: string }> }) {
  const { locale, hub } = await params;
  if (!isLoc(locale) || !isHub(hub)) notFound();
  const c = SC[locale], h = c.hubs[hub], d = dictFor(locale);
  const rel = ARTICLES.filter((a) => a.hub === hub || (hub === "recovery" && a.cat === "trichology") || (hub === "consultation" && a.cat === "trichology"));
  return (
    <div className="pg"><div className="wrap">
      <div className="pg-head">
        <p className="crumb"><a href={`/${locale}/services`}>{c.servicesTitle}</a><span aria-hidden="true">/</span><span>{h.title}</span></p>
        <h1>{h.title}</h1><p className="lead">{h.lead}</p>
      </div>
      <h2 className="sub" style={{ marginTop: 8 }}>{c.hubLabels.what}</h2>
      <ul className="plain-list">{h.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <p className="hub-note">{h.note}</p>
      <div className="pg-cta">
        <a className="btn btn-primary" href={`/${locale}/book?service=${HUB_SERVICE[hub]}`}>{d.ctaBook}</a>
        <AskButton label={c.hubLabels.ask} className="btn btn-secondary" />
      </div>
      {rel.length > 0 && <><h2 className="sub">{c.hubLabels.related}</h2><div className="art-list">{rel.map((a) => <ArticleCard key={a.slug} a={a} locale={locale} />)}</div></>}
    </div></div>
  );
}
