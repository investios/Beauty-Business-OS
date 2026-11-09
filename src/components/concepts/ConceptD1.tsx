import { COPY, type CLang } from "@/lib/concept-copy";
import ConceptBar from "./ConceptBar";
import { Faq, Foot, Frame } from "./Shared";

/** D1 «Жемчуг и пудра»: светлый, воздушный, как меню спа. Услуги списком, без карточек. */
export default function ConceptD1({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <div className="concept d1" data-theme="d1">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="d1" lang={lang} />
      <header className="d1-head band-light">
        <div className="wrap d1-head-in">
          <nav className="d1-nav" aria-label="Main">{c.nav.slice(0, 3).map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
          <a className="d1-mark" href={`/concepts/d1?lang=${lang}`}>MK<span>Extension Studio</span></a>
          <div className="d1-head-r">
            <nav className="d1-nav" aria-label="More">{c.nav.slice(3).map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
            <a className="btn btn-primary btn-sm" href={`/${lang}/book`}>{c.book}</a>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="d1-hero band-light">
          <div className="wrap d1-hero-grid">
            <div className="d1-hero-copy">
              <h1>{c.heroTitle}</h1>
              <p className="d1-lead">{c.heroText}</p>
              <div className="cta-row">
                <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
                <a className="btn btn-secondary" href="#results">{c.heroCta2}</a>
              </div>
            </div>
            <div className="d1-arch"><Frame lang={lang} shape="arch" /></div>
          </div>
        </section>

        <section className="d1-menu band-light alt" id="services">
          <div className="wrap d1-narrow">
            <h2>{c.servicesTitle}</h2>
            <p className="d1-sub">{c.servicesLead}</p>
            <div className="d1-list">
              {c.cards.map((k) => (
                <article key={k.id} id={k.id} className="d1-row">
                  <h3>{k.title}</h3>
                  <p>{k.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="d1-flow band-light">
          <div className="wrap">
            <h2>{c.stepsTitle}</h2>
            <ol className="d1-steps">
              {c.steps.map((s, i) => <li key={s.title}><span aria-hidden="true">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="d1-results band-light alt" id="results">
          <div className="wrap">
            <h2>{c.resultsTitle}</h2>
            <p className="d1-sub">{c.resultsText}</p>
            <div className="d1-pair"><Frame lang={lang} shape="arch" note={c.before} /><Frame lang={lang} shape="arch" note={c.after} /></div>
          </div>
        </section>

        <section className="d1-know band-light" id="knowledge">
          <div className="wrap d1-narrow">
            <h2>{c.knowTitle}</h2>
            <p className="d1-sub">{c.knowText}</p>
            <ul className="d1-know-list">{c.know.map((t) => <li key={t}><span>{t}</span><em>{c.knowTag}</em></li>)}</ul>
          </div>
        </section>

        <section className="d1-faq band-light alt">
          <div className="wrap d1-narrow"><h2>{c.faqTitle}</h2><Faq lang={lang} /></div>
        </section>

        <section className="d1-cta band-light">
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
