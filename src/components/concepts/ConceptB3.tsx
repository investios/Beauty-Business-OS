import { COPY, type CLang } from "@/lib/concept-copy";
import { BCOPY } from "@/lib/concept-copy-b";
import ConceptBar from "./ConceptBar";
import { Faq, Foot, PhotoSlot } from "./Shared";

/** Услуги привязаны к этапам пути: так структура сама рассказывает, как всё проходит. */
const STAGE_CARDS: string[][] = [["consultation"], ["hair"], ["extensions", "own"], ["correction", "removal"]];

export default function ConceptB3({ lang }: { lang: CLang }) {
  const c = COPY[lang], b = BCOPY[lang];
  const card = (id: string) => c.cards.find((k) => k.id === id)!;
  return (
    <div className="concept v3 band-light" data-theme="b">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="b3" lang={lang} />
      <main id="main" className="wrap v3-grid">
        <aside className="v3-side">
          <a className="v3-mark" href={`/concepts/b3?lang=${lang}`}>MK Extension Studio</a>
          <h1>{c.heroTitle}</h1>
          <p className="v3-lead">{c.heroText}</p>
          <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
        </aside>

        <div className="v3-path">
          <h2 className="v3-path-h">{b.threadLead}</h2>
          <ol className="v3-thread">
            {c.steps.map((s, i) => (
              <li key={s.title} className="v3-stage">
                <span className="v3-bead" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p className="v3-stage-text">{s.text}</p>
                <dl className="v3-also">
                  {STAGE_CARDS[i].map((id) => { const k = card(id); return <div key={id} id={id}><dt>{k.title}</dt><dd>{k.text}</dd></div>; })}
                </dl>
              </li>
            ))}
          </ol>
          <p className="v3-note">{c.servicesLead}</p>
        </div>
      </main>

      <section className="wrap v3-below" id="results">
        <h2>{c.resultsTitle}</h2>
        <p className="v3-note">{c.resultsText}</p>
        <PhotoSlot lang={lang} />
        <h2 className="v3-faq-h">{c.faqTitle}</h2>
        <Faq lang={lang} />
        <div className="v3-end">
          <h2>{c.ctaTitle}</h2>
          <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
        </div>
      </section>
      <Foot lang={lang} />
    </div>
  );
}
