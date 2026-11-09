import { COPY, CLANGS, THEMES, THEME_NAME, type CLang, type Theme } from "@/lib/concept-copy";

/** Оригинальный декоративный рисунок прядей (не фото работ). Цвет задаётся темой. */
function Strands() {
  const paths: string[] = [];
  for (let i = 0; i < 16; i++) {
    const x = 40 + i * 22, s = (i % 4) * 14;
    paths.push(`M${x} -10 C ${x + 90 + s} 120, ${x - 70 - s} 250, ${x + 40} 380 S ${x - 30} 560, ${x + 50} 640`);
  }
  return (
    <svg viewBox="0 0 440 640" role="img" aria-label="" aria-hidden="true" preserveAspectRatio="xMidYMid slice" className="strands">
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i % 3 === 0 ? 2 : 1} opacity={0.25 + (i % 5) * 0.13} />)}
    </svg>
  );
}

const href = (lang: CLang, theme: Theme) => `/concepts/${theme}?lang=${lang}`;

export default function ConceptHome({ theme, lang }: { theme: Theme; lang: CLang }) {
  const c = COPY[lang];
  const heroBand = theme === "b" ? "band-light alt" : "band-dark";
  return (
    <div className="concept" data-theme={theme}>
      <a className="skip" href="#main">{c.skip}</a>
      <div className="strip">
        <span>{c.strip}</span>
        <span className="strip-links">
          <span>{c.variant}:</span>
          {THEMES.map((t) => <a key={t} href={href(lang, t)} aria-current={t === theme ? "true" : undefined} title={THEME_NAME[t][lang]}>{t.toUpperCase()}</a>)}
          <span className="sep" aria-hidden="true" />
          {CLANGS.map((l) => <a key={l} href={href(l, theme)} aria-current={l === lang ? "true" : undefined}>{l === "uk" ? "UA" : l.toUpperCase()}</a>)}
        </span>
      </div>
      <header className={`site-head ${heroBand}`}>
        <div className="wrap head-in">
          <a className="wordmark" href={`/concepts/${theme}?lang=${lang}`}>MK <span>Extension Studio</span></a>
          <nav className="topnav" aria-label="Main">{c.nav.map((n) => <a key={n.href} href={n.href}>{n.label}</a>)}</nav>
          <a className="btn btn-primary btn-sm" href={`/${lang}/book`}>{c.book}</a>
        </div>
      </header>
      <main id="main">
        <section className={`hero ${heroBand}`}>
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="kicker">MK Extension Studio · Dublin</p>
              <h1>{c.heroTitle}</h1>
              <p className="lead">{c.heroText}</p>
              <div className="cta-row">
                <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
                <a className="btn btn-secondary" href="#results">{c.heroCta2}</a>
              </div>
              <ul className="chips">{c.chips.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <figure className="hero-art">
              <div className="art-frame"><Strands /></div>
              <figcaption>{c.heroCaption}</figcaption>
            </figure>
          </div>
        </section>

        <section className="band-light sec" id="services">
          <div className="wrap">
            <h2>{c.servicesTitle}</h2>
            <p className="sec-lead">{c.servicesLead}</p>
            <div className="cards">
              {c.cards.map((k, i) => (
                <article key={k.id} className="card" id={k.id}>
                  <span className="num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{k.title}</h3>
                  <p>{k.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band-dark sec">
          <div className="wrap">
            <h2>{c.stepsTitle}</h2>
            <ol className="steps">
              {c.steps.map((s, i) => (
                <li key={s.title}><span className="step-n" aria-hidden="true">{i + 1}</span><h3>{s.title}</h3><p>{s.text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band-light alt sec" id="results">
          <div className="wrap">
            <h2>{c.resultsTitle}</h2>
            <p className="sec-lead">{c.resultsText}</p>
            <div className="results">
              {[1, 2, 3].map((n) => (
                <div key={n} className="result">
                  <div className="ph"><span>{c.before}</span></div>
                  <div className="ph"><span>{c.after}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band-light sec" id="knowledge">
          <div className="wrap">
            <h2>{c.knowTitle}</h2>
            <p className="sec-lead">{c.knowText}</p>
            <div className="know">
              {c.know.map((t) => <article key={t} className="card know-card"><span className="tag">{c.knowTag}</span><h3>{t}</h3></article>)}
            </div>
          </div>
        </section>

        <section className="band-light alt sec" id="faq">
          <div className="wrap narrow">
            <h2>{c.faqTitle}</h2>
            <div className="faq">
              {c.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
            </div>
          </div>
        </section>

        <section className="band-dark sec cta-final">
          <div className="wrap">
            <h2>{c.ctaTitle}</h2>
            <div className="cta-row center">
              <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
              <a className="btn btn-secondary" href="#faq">{c.questions}</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="foot band-dark">
        <div className="wrap"><p>{c.footer}</p><p><a href={`/${lang}/privacy`}>{c.privacy}</a></p></div>
      </footer>
      <div className="mbar">
        <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
        <a className="btn btn-secondary" href="#faq">{c.questions}</a>
      </div>
    </div>
  );
}
