import { notFound } from "next/navigation";
import { isLoc, dictFor } from "@/lib/i18n";
import { getDb } from "@/lib/db";
import { getTenantBySlug } from "@/lib/booking";
import { activeKnowledge } from "@/lib/ai";
import { SC, HUBS, HUB_IMG, type HubId } from "@/lib/site-copy";
import { ARTICLES, localize } from "@/lib/library";
import { AskButton } from "@/components/Chrome";
import { IcArrow, IcAward, IcCalendar, IcCap, IcDiamond, IcDrop, IcFlask, IcHeart, IcLeaf, IcPeople } from "@/components/Icons";
import { ArticleCard } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";
const TILE_HUBS: HubId[] = ["extensions", "trichology", "recovery", "care"];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale), c = SC[locale];
  const db = await getDb();
  const tenant = (await getTenantBySlug(db, "demo"))!;
  const kb = await activeKnowledge(db, tenant.id);
  const ans = (topic: string) => kb.snapshot.find((a) => a.topic === topic && a.locale === locale)?.answer ?? "";
  const proofIcons = [IcDiamond, IcFlask, IcHeart];
  const factIcons = [IcAward, IcCap, IcPeople];
  const art: Record<string, React.ReactNode> = { recovery: <IcDrop />, care: <IcLeaf /> };
  return (
    <>
      <section className="lx-hero" aria-labelledby="h1">
        <div className="wrap">
          <div className="lx-hero-copy">
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <p className="lx-name" aria-hidden="true">{c.hero.name}</p>
            <h1 id="h1"><span className="sr-only">{c.hero.name}. </span>{c.hero.title}</h1>
            <p className="lead">{c.hero.text}</p>
            <div className="lx-cta">
              <a className="btn btn-primary d-only" href={`/${locale}/book`}><IcCalendar className="ic" />{c.hero.cta1}</a>
              <a className="btn btn-secondary d-only" href={`/${locale}/about`}>{c.hero.cta2}</a>
              <AskButton label={d.ctaAskBook} className="btn btn-primary m-only" />
              <a className="btn btn-secondary m-only" href={`/${locale}/book`}><IcCalendar className="ic" />{d.ctaCalendar}</a>
            </div>
            <ul className="lx-proof">{c.hero.proof.map((p, i) => { const I = proofIcons[i]; return <li key={p}><I />{p}</li>; })}</ul>
          </div>
          <figure className="lx-photo">
            <picture>
              <img src="/img/mila-hero-800.webp" srcSet="/img/mila-hero-480.webp 480w, /img/mila-hero-800.webp 800w, /img/mila-hero-1320.webp 1320w" sizes="(min-width: 900px) 62vw, 100vw" width={800} height={944} alt={c.hero.alt} fetchPriority="high" />
            </picture>
            <p className="lx-slogan" aria-hidden="true">{c.hero.slogan}</p>
          </figure>
        </div>
      </section>

      <section className="lx-tiles" aria-label={c.servicesTitle}>
        <div className="wrap">
          <div className="tiles">
            {TILE_HUBS.map((id) => {
              const h = c.hubs[id], img = HUB_IMG[id];
              return (
                <a key={id} className="tile" href={`/${locale}/services/${id}`}>
                  <div className="t-body"><h3>{h.title}</h3><p>{h.tile}</p></div>
                  {img ? <img src={`/img/${img.a}.webp`} srcSet={`/img/${img.a}.webp ${img.wa}w, /img/${img.b}.webp ${img.wb}w`} sizes="(min-width: 1000px) 14vw, 45vw" alt="" loading="lazy" width={img.w} height={img.h} /> : <div className="t-art" aria-hidden="true">{art[id]}</div>}
                  <span className="go" aria-hidden="true"><IcArrow /></span>
                  <span className="sr-only">{c.more}</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lx-about" id="about">
        <div className="wrap about-grid">
          <figure className="about-photo"><img src="/img/mila-portrait-360.webp" srcSet="/img/mila-portrait-360.webp 360w, /img/mila-portrait-680.webp 680w" sizes="280px" width={360} height={360} alt={c.aboutBlock.alt} loading="lazy" /></figure>
          <div className="about-copy">
            <p className="eyebrow">{c.aboutBlock.eyebrow}</p>
            <h2>{c.aboutBlock.title}</h2>
            <p>{c.aboutBlock.text}</p>
            <a className="link-ul" href={`/${locale}/about`}>{c.aboutBlock.link}<IcArrow className="ic" /></a>
          </div>
          <ul className="facts">{c.aboutBlock.facts.map((f, i) => { const I = factIcons[i]; return <li key={f}><I />{f}</li>; })}</ul>
        </div>
      </section>

      <section className="lx-sec alt" aria-labelledby="lib-h">
        <div className="wrap">
          <div className="lx-head">
            <div><p className="eyebrow">{c.lib.eyebrow}</p><h2 id="lib-h" style={{ marginTop: 12 }}>{c.lib.title}</h2><p className="sec-lead">{c.lib.text}</p></div>
            <a className="btn btn-secondary btn-sm" href={`/${locale}/library`}>{c.lib.all}</a>
          </div>
          <div className="art-list three">{ARTICLES.map((a) => <ArticleCard key={a.slug} a={a} locale={locale} />)}</div>
        </div>
      </section>

      <section className="lx-sec" aria-labelledby="how-h">
        <div className="wrap">
          <h2 id="how-h">{d.howTitle}</h2>
          <ol className="lx-steps">{[d.how1, d.how2, d.how3, d.how4].map((s) => <li key={s}><p>{s}</p></li>)}</ol>
          <p className="note">{d.aiNote}</p>
        </div>
      </section>

      <section className="lx-sec alt" aria-labelledby="faq-h">
        <div className="wrap narrow" style={{ maxWidth: 780 }}>
          <h2 id="faq-h" style={{ marginBottom: 24 }}>{d.faqTitle}</h2>
          <div className="faq">
            <details><summary>{d.faq1q}</summary><p>{ans("price")}</p></details>
            <details><summary>{d.faq2q}</summary><p>{ans("consultation")}</p></details>
            <details><summary>{d.faq3q}</summary><p>{d.faq3a}</p></details>
            <details><summary>{d.faq4q}</summary><p>{d.faq4a}</p></details>
          </div>
        </div>
      </section>

      <section className="lx-sec" aria-labelledby="fin-h">
        <div className="wrap">
          <div className="lx-final">
            <h2 id="fin-h">{d.finalTitle}</h2>
            <p>{d.finalText}</p>
            <div className="lx-cta" style={{ justifyContent: "center" }}>
              <a className="btn btn-primary" href={`/${locale}/book`}>{d.ctaBook}</a>
              <AskButton label={d.ctaAsk} className="btn btn-secondary" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
void HUBS;
