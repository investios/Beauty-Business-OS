import { COPY, type CLang } from "@/lib/concept-copy";

export function Faq({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <div className="qa" id="faq">
      {c.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
    </div>
  );
}

export function Foot({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <>
      <footer className="foot band-dark">
        <div className="wrap"><p>{c.footer}</p><p><a href={`/${lang}/privacy`}>{c.privacy}</a></p></div>
      </footer>
      <div className="mbar">
        <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
        <a className="btn btn-secondary" href="#faq">{c.questions}</a>
      </div>
    </>
  );
}

/** Место под реальное фото до/после. Подписано честно, это не результат работы. */
export function PhotoSlot({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <div className="slot-pair">
      <div className="ph"><span>{c.before}</span></div>
      <div className="ph"><span>{c.after}</span></div>
    </div>
  );
}
