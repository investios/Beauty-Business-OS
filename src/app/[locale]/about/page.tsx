import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { altFor, robotsFor } from "@/lib/seo";
import { isLoc } from "@/lib/i18n";
import { SC } from "@/lib/site-copy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params; if (!isLoc(locale)) return {};
  return { title: SC[locale].aboutPage.title, description: SC[locale].aboutPage.lead, alternates: altFor(locale, "/about"), robots: robotsFor(true) };
}
export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const c = SC[locale], a = c.aboutPage;
  return (
    <div className="pg"><div className="wrap">
      <div className="about-grid" style={{ marginBottom: 36 }}>
        <figure className="about-photo"><img src="/img/mila-portrait-680.webp" width={680} height={680} alt={c.aboutBlock.alt} /></figure>
        <div className="pg-head" style={{ margin: 0 }}><p className="eyebrow">{c.aboutBlock.eyebrow}</p><h1>{a.title}</h1><p className="lead">{a.lead}</p></div>
      </div>
      <div style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        {a.blocks.map((b) => <section key={b.h}><h2 className="sub" style={{ margin: "0 0 8px" }}>{b.h}</h2><p>{b.p}</p></section>)}
      </div>
      <div className="pg-cta"><a className="btn btn-primary" href={`/${locale}/book`}>{a.cta}</a></div>
    </div></div>
  );
}
