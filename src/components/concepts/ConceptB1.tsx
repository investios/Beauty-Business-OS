import { COPY, type CLang } from "@/lib/concept-copy";
import ConceptBar from "./ConceptBar";
import { Faq, Foot, PhotoSlot } from "./Shared";

/** Оттенки волос от тёмного к светлому. Декоративный образ, не фото работ. */
const SHADES = ["#2B1F1A", "#3E2C23", "#55392C", "#7A5340", "#A57A59", "#C9A27A", "#E0C49C", "#EBD7B5", "#F2E6D0"];
/** Полосы услуг: цвет полосы и цвет текста на ней (контраст проверен отдельно). */
const STRIPS: [string, string][] = [
  ["#2B1F1A", "#F5EEE6"], ["#3E2C23", "#F5EEE6"], ["#55392C", "#F5EEE6"],
  ["#C9A27A", "#2B1F1A"], ["#E0C49C", "#2B1F1A"], ["#F2E6D0", "#2B1F1A"],
];

function Fan() {
  return (
    <div className="fan" aria-hidden="true">
      {SHADES.map((c, i) => (
        <i key={c} style={{ "--a": `${(i - 4) * 9}deg`, "--c": c } as React.CSSProperties} />
      ))}
      <b />
    </div>
  );
}

export default function ConceptB1({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <div className="concept v1" data-theme="b">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="b1" lang={lang} />
      <header className="v1-head band-light">
        <div className="wrap v1-head-in">
          <a className="v1-mark" href={`/concepts/b1?lang=${lang}`}>MK Extension Studio</a>
          <nav className="v1-nav" aria-label="Main">{c.nav.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
          <a className="btn btn-primary btn-sm" href={`/${lang}/book`}>{c.book}</a>
        </div>
      </header>
      <main id="main">
        <section className="v1-hero band-light">
          <div className="wrap v1-hero-grid">
            <div>
              <h1>{c.heroTitle}</h1>
              <p className="v1-lead">{c.heroText}</p>
              <div className="cta-row">
                <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
                <a className="btn btn-secondary" href="#results">{c.heroCta2}</a>
              </div>
            </div>
            <figure className="v1-fig"><Fan /><figcaption>{c.heroCaption}</figcaption></figure>
          </div>
        </section>

        <section className="v1-services band-light" id="services">
          <div className="wrap">
            <h2>{c.servicesTitle}</h2>
            <p className="v1-sub">{c.servicesLead}</p>
          </div>
          <div className="v1-strips">
            {c.cards.map((k, i) => (
              <article key={k.id} id={k.id} className="v1-strip" style={{ "--bg": STRIPS[i][0], "--t": STRIPS[i][1] } as React.CSSProperties}>
                <h3>{k.title}</h3>
                <p>{k.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="v1-flow band-dark">
          <div className="wrap">
            <h2>{c.stepsTitle}</h2>
            <ol className="v1-flow-list">
              {c.steps.map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="v1-results band-light" id="results">
          <div className="wrap">
            <h2>{c.resultsTitle}</h2>
            <p className="v1-sub">{c.resultsText}</p>
            <PhotoSlot lang={lang} />
          </div>
        </section>

        <section className="v1-know band-light alt" id="knowledge">
          <div className="wrap v1-know-grid">
            <div><h2>{c.knowTitle}</h2><p className="v1-sub">{c.knowText}</p></div>
            <ul className="v1-know-list">
              {c.know.map((t) => <li key={t}><span>{t}</span><em>{c.knowTag}</em></li>)}
            </ul>
          </div>
        </section>

        <section className="v1-faq band-light">
          <div className="wrap v1-narrow"><h2>{c.faqTitle}</h2><Faq lang={lang} /></div>
        </section>

        <section className="v1-cta band-dark">
          <div className="wrap">
            <h2>{c.ctaTitle}</h2>
            <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
          </div>
        </section>
      </main>
      <Foot lang={lang} />
    </div>
  );
}
