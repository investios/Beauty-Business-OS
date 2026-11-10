import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";
import { AskButton } from "@/components/Chrome";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLoc(locale)) return {};
  return { title: SC[locale].results.title, description: `${SC[locale].results.lead} ${SC[locale].results.empty}`.slice(0, 160), alternates: altFor(locale, "/results"), robots: robotsFor(true) };
}
export default async function Results({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const c = SC[locale], r = c.results;
  return (
    <div className="pg"><div className="wrap">
      <div className="pg-head"><p className="eyebrow">MK Extension Studio</p><h1>{r.title}</h1><p className="lead">{r.lead}</p></div>
      <p className="hub-note" style={{ marginTop: 0 }}>{r.empty}</p>
      <p style={{ maxWidth: 720, marginTop: 18, color: "#4a423c" }}>{r.why}</p>
      <div className="pg-cta"><a className="btn btn-primary" href={`/${locale}/book`}>{c.hubs.consultation.title}</a><AskButton label={r.cta} className="btn btn-secondary" /></div>
    </div></div>
  );
}
