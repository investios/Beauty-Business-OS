import { COPY, type CLang } from "@/lib/concept-copy";
import { dictFor } from "@/lib/i18n";
import { BCOPY } from "@/lib/concept-copy-b";
import ConceptBar from "./ConceptBar";
import AskPanel from "./AskPanel";
import { Faq, Foot, Frame } from "./Shared";

const TILE = ["t1", "t2", "t3", "t4", "t5", "t6"];

/** D2 «Сатин и мальва»: мягкие пастельные плитки, на первом экране вопрос «что вы хотите изменить». */
export default function ConceptD2({ lang }: { lang: CLang }) {
  const c = COPY[lang], b = BCOPY[lang];
  return (
    <div className="concept d2" data-theme="d2">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="d2" lang={lang} />
      <header className="d2-head band-light">
        <div className="wrap d2-head-in">
          <a className="d2-mark" href={`/concepts/d2?lang=${lang}`}>MK Extension Studio</a>
          <nav className="d2-nav" aria-label="Main">{c.nav.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
          <a className="btn btn-primary btn-sm" href={`/${lang}/book`}>{c.book}</a>
        </div>
      </header>
      <main id="main">
        <section className="d2-hero band-light">
          <div className="wrap d2-hero-grid">
            <div className="d2-hero-copy">
              <h1>{c.heroTitle}</h1>
              <p className="d2-lead">{c.heroText}</p>
              <div className="d2-askbox">
                <h2>{b.askTitle}</h2>
                <AskPanel options={b.ask} cards={c.cards} bookLabel={c.book} bookHref={`/${lang}/book`} moreLabel={dictFor(lang).ctaAsk} hint={b.askHint} />
              </div>
            </div>
            <div className="d2-collage" aria-hidden="false">
              <Frame lang={lang} shape="circle" />
              <Frame lang={lang} shape="pill" />
              <Frame lang={lang} shape="round" />
            </div>
          </div>
        </section>

        <section className="d2-tiles-sec band-light" id="services">
          <div className="wrap">
            <h2>{c.servicesTitle}</h2>
            <p className="d2-sub">{c.servicesLead}</p>
            <div className="d2-tiles">
              {c.cards.map((k, i) => (
                <article key={k.id} id={k.id} className={`d2-tile ${TILE[i]}`}>
                  <h3>{k.title}</h3>
                  <p>{k.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="d2-flow band-light alt">
          <div className="wrap">
            <h2>{c.stepsTitle}</h2>
            <ol className="d2-steps">{c.steps.map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
          </div>
        </section>

        <section className="d2-results band-light" id="results">
          <div className="wrap">
            <h2>{c.resultsTitle}</h2>
            <p className="d2-sub">{c.resultsText}</p>
            <div className="d2-pair"><Frame lang={lang} shape="round" note={c.before} /><Frame lang={lang} shape="round" note={c.after} /></div>
          </div>
        </section>

        <section className="d2-faq band-light alt">
          <div className="wrap d2-narrow"><h2>{c.faqTitle}</h2><Faq lang={lang} /></div>
        </section>

        <section className="d2-cta band-light">
          <div className="wrap">
            <h2>{c.ctaTitle}</h2>
            <div className="cta-row center"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
          </div>
        </section>
      </main>
      <Foot lang={lang} />
    </div>
  );
}
