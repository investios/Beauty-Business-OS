import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getTenantBySlug, listServices } from "@/lib/booking";
import { activeKnowledge } from "@/lib/ai";
import { dictFor, isLoc } from "@/lib/i18n";
import { AskButton } from "@/components/Chrome";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  const d = dictFor(locale);
  const db = await getDb();
  const tenant = (await getTenantBySlug(db, "demo"))!;
  const services = await listServices(db, tenant.id);
  const kb = await activeKnowledge(db, tenant.id);
  const ans = (topic: string) => kb.snapshot.find((a) => a.topic === topic && a.locale === locale)?.answer ?? "";

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="kicker">{d.heroKicker}</p>
            <h1>{d.heroTitle}</h1>
            <p className="lead">{d.heroText}</p>
            <div className="hero-actions">
              <a className="btn btn-primary" href={`/${locale}/book`}>{d.ctaBook}</a>
              <AskButton label={d.ctaAsk} />
            </div>
            <ul className="trust">
              <li>{d.trust1}</li><li>{d.trust2}</li><li>{d.trust3}</li>
            </ul>
          </div>
          <div className="ph" role="img" aria-label={`${d.photoLabel}. ${d.photoNote}`}>
            <div className="ph-caption"><strong>{d.photoLabel}</strong><span>{d.photoNote}</span></div>
          </div>
        </div>
      </section>

      <section className="section alt" aria-labelledby="svc">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{d.servicesKicker}</p>
            <h2 id="svc">{d.servicesTitle}</h2>
            <p>{d.servicesNote}</p>
          </div>
          <div className="cards">
            {services.map((s, i) => (
              <article className="card" key={s.id}>
                <span className="num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title_i18n[locale]}</h3>
                <p>{s.desc_i18n[locale]}</p>
                <span className="meta">{s.duration_min} {d.minutes}</span>
                <a className="btn btn-secondary btn-sm" href={`/${locale}/book?service=${s.slug}`}>{d.bookThis}</a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="how">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{d.howKicker}</p>
            <h2 id="how">{d.howTitle}</h2>
          </div>
          <ol className="steps"><li>{d.how1}</li><li>{d.how2}</li><li>{d.how3}</li><li>{d.how4}</li></ol>
          <p className="note">{d.aiNote}</p>
        </div>
      </section>

      <section className="section alt" aria-labelledby="faq">
        <div className="wrap">
          <div className="section-head">
            <p className="kicker">{d.faqKicker}</p>
            <h2 id="faq">{d.faqTitle}</h2>
          </div>
          <div className="faq">
            <details><summary>{d.faq1q}</summary><p>{ans("price")}</p></details>
            <details><summary>{d.faq2q}</summary><p>{ans("consultation")}</p></details>
            <details><summary>{d.faq3q}</summary><p>{d.faq3a}</p></details>
            <details><summary>{d.faq4q}</summary><p>{d.faq4a}</p></details>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="final">
            <h2>{d.finalTitle}</h2>
            <p>{d.finalText}</p>
            <a className="btn btn-primary" href={`/${locale}/book`}>{d.ctaBook}</a>
          </div>
        </div>
      </section>
    </>
  );
}
