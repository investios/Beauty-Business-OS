import { COPY, type CLang } from "@/lib/concept-copy";
import { BCOPY } from "@/lib/concept-copy-b";
import ConceptBar from "./ConceptBar";
import AskPanel from "./AskPanel";
import { Faq, Foot, PhotoSlot } from "./Shared";

export default function ConceptB2({ lang }: { lang: CLang }) {
  const c = COPY[lang], b = BCOPY[lang];
  return (
    <div className="concept v2 band-light" data-theme="b">
      <a className="skip" href="#main">{c.skip}</a>
      <ConceptBar variant="b2" lang={lang} />
      <main id="main" className="v2-col">
        <header className="v2-head">
          <a className="v2-mark" href={`/concepts/b2?lang=${lang}`}>MK Extension Studio</a>
          <a className="v2-book" href={`/${lang}/book`}>{c.book}</a>
        </header>

        <section className="v2-hero">
          <h1>{c.heroTitle}</h1>
          <p className="v2-lead">{c.heroText}</p>
        </section>

        <section className="v2-ask" aria-labelledby="ask-h">
          <h2 id="ask-h">{b.askTitle}</h2>
          <AskPanel options={b.ask} cards={c.cards} bookLabel={c.book} bookHref={`/${lang}/book`} moreLabel={c.questions} hint={b.askHint} />
        </section>

        <section className="v2-sec">
          <h2>{c.stepsTitle}</h2>
          <ol className="v2-steps">{c.steps.map((s) => <li key={s.title}><strong>{s.title}.</strong> {s.text}</li>)}</ol>
          <p className="v2-note">{c.servicesLead}</p>
        </section>

        <section className="v2-sec" id="results">
          <h2>{c.resultsTitle}</h2>
          <p className="v2-note">{c.resultsText}</p>
          <PhotoSlot lang={lang} />
        </section>

        <section className="v2-sec">
          <h2>{c.faqTitle}</h2>
          <Faq lang={lang} />
        </section>

        <section className="v2-sec v2-end">
          <h2>{c.ctaTitle}</h2>
          <div className="cta-row"><a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a></div>
        </section>
      </main>
      <Foot lang={lang} />
    </div>
  );
}
