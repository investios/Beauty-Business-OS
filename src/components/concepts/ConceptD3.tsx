import { COPY, type CLang } from "@/lib/concept-copy";
import { BCOPY } from "@/lib/concept-copy-b";
import ConceptBar from "./ConceptBar";
import { Faq, Foot, Frame } from "./Shared";

const STAGE_CARDS: string[][] = [["consultation"], ["hair"], ["extensions", "own"], ["correction", "removal"]];

/** D3 «Шалфей и шампань»: путь от консультации до коррекции, слева закреплено место под портрет. */
export default function ConceptD3({ lang }: { lang: CLang }) {
  const c = COPY[lang], b = BCOPY[lang];
  const card = (id: string) => c.cards.find((k) => k.id === id)!;
  return (
    <div className="concept d3 band-light" data-theme="d3">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="d3" lang={lang} />
      <main id="main" className="wrap d3-grid">
        <aside className="d3-side">
          <a className="d3-mark" href={`/concepts/d3?lang=${lang}`}>MK Extension Studio</a>
          <h1>{c.heroTitle}</h1>
          <p className="d3-lead">{c.heroText}</p>
          <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
          <div className="d3-portrait"><Frame lang={lang} shape="tall" /></div>
        </aside>
        <div className="d3-path">
          <h2 className="d3-path-h">{b.threadLead}</h2>
          <ol className="d3-thread">
            {c.steps.map((s, i) => (
              <li key={s.title} className="d3-stage">
                <span className="d3-bead" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="d3-stage-text">{s.text}</p>
                <dl className="d3-also">
                  {STAGE_CARDS[i].map((id) => { const k = card(id); return <div key={id} id={id}><dt>{k.title}</dt><dd>{k.text}</dd></div>; })}
                </dl>
              </li>
            ))}
          </ol>
          <p className="d3-note">{c.servicesLead}</p>
        </div>
      </main>
      <section className="wrap d3-below" id="results">
        <h2>{c.resultsTitle}</h2>
        <p className="d3-note">{c.resultsText}</p>
        <div className="d3-pair"><Frame lang={lang} shape="tall" note={c.before} /><Frame lang={lang} shape="tall" note={c.after} /></div>
        <h2 className="d3-faq-h">{c.faqTitle}</h2>
        <Faq lang={lang} />
        <div className="d3-end">
          <h2>{c.ctaTitle}</h2>
          <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
        </div>
      </section>
      <Foot lang={lang} />
    </div>
  );
}
