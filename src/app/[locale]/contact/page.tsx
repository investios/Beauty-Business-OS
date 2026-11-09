import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";
import { AskButton } from "@/components/Chrome";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLoc(locale)) return {};
  return { title: SC[locale].contact.title, description: SC[locale].contact.lead, alternates: altFor(locale, "/contact"), robots: robotsFor(true) };
}
export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const c = SC[locale], k = c.contact;
  return (
    <div className="pg"><div className="wrap">
      <div className="pg-head"><p className="eyebrow">MK Extension Studio</p><h1>{k.title}</h1><p className="lead">{k.lead}</p></div>
      <ul className="plain-list">{k.rows.map((r) => <li key={r.h}><span><b>{r.h}.</b> {r.p}</span></li>)}</ul>
      <div className="pg-cta"><a className="btn btn-primary" href={`/${locale}/book`}>{k.cta}</a><AskButton label={c.hubLabels.ask} className="btn btn-secondary" /></div>
    </div></div>
  );
}
