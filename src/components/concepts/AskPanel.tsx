"use client";
import { useState } from "react";
import { AskButton } from "@/components/Chrome";

type Opt = { id: string; label: string };
type Card = { id: string; title: string; text: string };

/** Выбор цели на главной. Показывает уже утверждаемый текст услуги и кнопку записи. Ничего не отправляет. */
export default function AskPanel({ options, cards, bookLabel, bookHref, moreLabel, hint }: { options: Opt[]; cards: Card[]; bookLabel: string; bookHref: string; moreLabel: string; hint: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const card = cards.find((c) => c.id === sel);
  return (
    <div className="ask">
      <div className="ask-opts" role="group" aria-label={hint}>
        {options.map((o) => (
          <button key={o.id} type="button" className="ask-opt" aria-pressed={sel === o.id} onClick={() => setSel(o.id)}>{o.label}</button>
        ))}
      </div>
      <div className="ask-out" aria-live="polite">
        {card ? (
          <div className="ask-card">
            <h3>{card.title}</h3>
            <p>{card.text}</p>
            <div className="cta-row">
              <a className="btn btn-primary" href={bookHref}>{bookLabel}</a>
              <AskButton label={moreLabel} className="btn btn-secondary" />
            </div>
          </div>
        ) : <p className="ask-hint">{hint}</p>}
      </div>
    </div>
  );
}
