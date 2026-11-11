import type { ReactNode } from "react";
/**
 * Единый набор иконок студии (свои, контурные). Сетка 32×32, линия 1.6, скругления на концах.
 * Основной контур currentColor, один акцентный штрих в цвете шампань (.ac) — в каждой иконке.
 * Декоративные: aria-hidden.
 */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;
const AC = { stroke: "var(--accent)", className: "ac" } as const;
const mk = (d: ReactNode) => function Icon({ className }: { className?: string }) { return <svg viewBox="0 0 32 32" className={className} {...S}>{d}</svg>; };

export const IcCalendar = mk(<><rect x="5" y="7" width="22" height="20" rx="4" /><path d="M5 13h22M11 4v5M21 4v5" /><path d="M11 19h4M17 19h4" {...AC} /></>);
export const IcArrow = mk(<><path d="M6 16h19" /><path d="M18 9l7 7-7 7" {...AC} /></>);
/** качество / экспертный подход */
export const IcDiamond = mk(<><path d="M8 6h16l5 7-13 14L3 13z" /><path d="M3 13h26" {...AC} /><path d="M12 6l-3 7 7 14 7-14-3-7" /></>);
/** научная основа */
export const IcFlask = mk(<><path d="M12 4h8M13 4v8L5 25a2.5 2.5 0 0 0 2.2 3.6h17.6A2.5 2.5 0 0 0 27 25l-8-13V4" /><path d="M9 20h14" {...AC} /></>);
export const IcHeart = mk(<><path d="M16 27S4 19.5 4 11.5A6.5 6.5 0 0 1 16 8a6.5 6.5 0 0 1 12 3.5C28 19.5 16 27 16 27z" /><path d="M9 12a3.5 3.5 0 0 1 3-2.5" {...AC} /></>);
export const IcAward = mk(<><circle cx="16" cy="12" r="8" /><path d="M11 19l-3 9 8-4 8 4-3-9" /><path d="M16 8.5v7M12.5 12h7" {...AC} /></>);
export const IcCap = mk(<><path d="M2 12l14-7 14 7-14 7z" /><path d="M8 15v7c0 2 4 4 8 4s8-2 8-4v-7" /><path d="M30 12v9" {...AC} /></>);
export const IcPeople = mk(<><circle cx="16" cy="11" r="4" /><path d="M8 27c0-5 3.5-8 8-8s8 3 8 8" /><path d="M5 14a3 3 0 0 1 3-3M27 14a3 3 0 0 0-3-3" {...AC} /></>);
/** восстановление: капля питания */
export const IcDrop = mk(<><path d="M16 4C11 11 8 15 8 19a8 8 0 0 0 16 0c0-4-3-8-8-15z" /><path d="M12.5 20a3.5 3.5 0 0 0 3.5 3.5" {...AC} /></>);
/** наращивание: три пряди */
export const IcStrand = mk(<><path d="M10 3c5 5-5 10 0 15s-3 8 0 11" /><path d="M22 3c5 5-5 10 0 15s-3 8 0 11" /><path d="M16 3c5 5-5 10 0 15s-3 8 0 11" {...AC} /></>);
/** уход */
export const IcLeaf = mk(<><path d="M5 27C5 12 14 5 27 5c0 13-7 22-20 22z" /><path d="M5 27L18 14" {...AC} /></>);
/** трихология: лупа над прядью */
export const IcScope = mk(<><circle cx="14" cy="14" r="9" /><path d="M21 21l7 7" /><path d="M11 9c3 3-3 5 0 8s-1 3 0 4" {...AC} /></>);
/** консультация: диалог */
export const IcChat = mk(<><path d="M5 8a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H14l-6 5v-5H9a4 4 0 0 1-4-4z" /><path d="M11 12h10M11 16h6" {...AC} /></>);
