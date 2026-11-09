import { notFound } from "next/navigation";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc } from "@/lib/i18n";
import { SC, HUBS } from "@/lib/site-copy";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLoc(locale)) return {};
  return { title: SC[locale].servicesTitle, description: SC[locale].servicesLead, alternates: altFor(locale, "/services"), robots: robotsFor(true) };
}
export default async function Services({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const c = SC[locale];
  return (
    <div className="pg"><div className="wrap">
      <div className="pg-head"><p className="eyebrow">MK Extension Studio</p><h1>{c.servicesTitle}</h1><p className="lead">{c.servicesLead}</p></div>
      <div className="hub-grid">
        {HUBS.map((id) => <a key={id} className="hub-card" href={`/${locale}/services/${id}`}><h3>{c.hubs[id].title}</h3><p>{c.hubs[id].lead}</p><span className="more">{c.more}</span></a>)}
      </div>
    </div></div>
  );
}
