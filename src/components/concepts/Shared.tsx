import { COPY, type CLang } from "@/lib/concept-copy";
import { BCOPY } from "@/lib/concept-copy-b";
import { dictFor } from "@/lib/i18n";
import Chat from "@/components/Chat";
import { AskButton } from "@/components/Chrome";

export function Faq({ lang }: { lang: CLang }) {
  const c = COPY[lang];
  return (
    <div className="qa" id="faq">
      {c.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
    </div>
  );
}

export function Foot({ lang }: { lang: CLang }) {
  const c = COPY[lang], d = dictFor(lang);
  return (
    <>
      <footer className="foot band-dark">
        <div className="wrap"><p>{c.footer}</p><p><a href={`/${lang}/privacy`}>{c.privacy}</a></p></div>
      </footer>
      <div className="mbar">
        <a className="btn btn-primary" href={`/${lang}/book`}>{c.book}</a>
        <AskButton label={d.ctaAsk} className="btn btn-secondary" />
      </div>
      <AskButton label={d.ctaAsk} className="btn btn-primary concept-fab" />
      <Chat locale={lang} d={d} />
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

/** Рамка под реальное фото. Честно подписана: это место для фото, а не результат работы. */
export function Frame({ lang, shape = "", note }: { lang: CLang; shape?: string; note?: string }) {
  return <div className={`pf ${shape}`}><span>{note ?? BCOPY[lang].frame}</span></div>;
}
