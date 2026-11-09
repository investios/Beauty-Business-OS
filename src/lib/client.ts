"use client";
// Источник обращения (UTM/ref) запоминается на время сессии и уходит с записью/диалогом
export function captureSource(): Record<string, string> {
  try {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref"];
    const cur = JSON.parse(sessionStorage.getItem("src") ?? "{}") as Record<string, string>;
    const q = new URLSearchParams(window.location.search);
    let changed = false;
    for (const k of keys) { const v = q.get(k); if (v && !cur[k]) { cur[k] = v.slice(0, 100); changed = true; } }
    if (!cur.landing) { cur.landing = window.location.pathname; changed = true; }
    if (!cur.referrer && document.referrer) { try { cur.referrer = new URL(document.referrer).hostname; changed = true; } catch {} }
    if (changed) sessionStorage.setItem("src", JSON.stringify(cur));
    return cur;
  } catch { return {}; }
}
export const TENANT = "demo";
export const api = (p: string) => `/api/v1/public/${TENANT}/${p}`;
export function newKey() { return crypto.randomUUID(); }
export const tzDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date(iso));
