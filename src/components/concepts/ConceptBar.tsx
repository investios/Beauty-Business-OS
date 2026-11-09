import { CLANGS, COPY, VARIANTS_SHOWN, VARIANT_NAME, type CLang, type Variant } from "@/lib/concept-copy";

/** Тонкая служебная панель макета: переключатель варианта и языка. Не часть будущего сайта. */
export default function ConceptBar({ variant, lang }: { variant: Variant; lang: CLang }) {
  const c = COPY[lang];
  const href = (l: CLang, v: Variant) => `/concepts/${v}?lang=${l}`;
  return (
    <div className="strip">
      <span>{c.strip}</span>
      <span className="strip-links">
        <span>{c.variant}:</span>
        {(VARIANTS_SHOWN.includes(variant) ? VARIANTS_SHOWN : [...VARIANTS_SHOWN, variant]).map((v) => <a key={v} href={href(lang, v)} aria-current={v === variant ? "true" : undefined} title={VARIANT_NAME[v]}>{v.toUpperCase()}</a>)}
        <span className="sep" aria-hidden="true" />
        {CLANGS.map((l) => <a key={l} href={href(l, variant)} aria-current={l === lang ? "true" : undefined}>{l === "uk" ? "UA" : l.toUpperCase()}</a>)}
      </span>
    </div>
  );
}
