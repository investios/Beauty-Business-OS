"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "@/lib/i18n";
import { api, captureSource, newKey, tzDay } from "@/lib/client";
type Dict = Record<Key, string>;
type Svc = { id: string; slug: string; title: string; desc: string; duration: number };
type Slot = { startUtc: string; endUtc: string; label: string };
type Done = { id: string; token: string; startsAtUtc: string; delivery: string };

const HORIZON = 120; // дней вперёд: запись на 2–3 недели и повторные визиты на 3 месяца
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const bcp = (loc: string) => (loc === "uk" ? "uk-UA" : loc === "ru" ? "ru-RU" : "en-IE");

/** Месячный календарь: неделя с понедельника, свободные дни выделены, листание по месяцам */
function Calendar({ locale, d, free, value, onPick }: { locale: string; d: Dict; free: Set<string>; value: string; onPick: (k: string) => void }) {
  const todayKey = tzDay(new Date().toISOString());
  const [ty, tm] = todayKey.split("-").map(Number);
  const firstFree = [...free].sort()[0] ?? todayKey;
  const start = value || firstFree;
  const [view, setView] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) });
  const idx = (y: number, m: number) => y * 12 + (m - 1);
  const minIdx = idx(ty, tm);
  const maxD = new Date(Date.UTC(ty, tm - 1, Number(todayKey.slice(8)) + HORIZON));
  const maxIdx = idx(maxD.getUTCFullYear(), maxD.getUTCMonth() + 1);
  const cur = idx(view.y, view.m);
  const go = (n: number) => { const t = Math.min(maxIdx, Math.max(minIdx, cur + n)); setView({ y: Math.floor(t / 12), m: (t % 12) + 1 }); };
  const first = new Date(Date.UTC(view.y, view.m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const l = bcp(locale);
  const title = new Intl.DateTimeFormat(l, { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
  const wds = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(l, { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const longDay = (k: string) => new Intl.DateTimeFormat(l, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(k + "T00:00:00Z"));
  const monthFree = [...free].some((k) => k.startsWith(`${view.y}-${pad(view.m)}`));
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label={d.calPrev} disabled={cur <= minIdx} onClick={() => go(-1)}>‹</button>
        <h3 className="cal-title" aria-live="polite">{title}</h3>
        <button type="button" className="cal-nav" aria-label={d.calNext} disabled={cur >= maxIdx} onClick={() => go(1)}>›</button>
      </div>
      <div className="cal-grid" role="group" aria-label={title}>
        {wds.map((w) => <span key={w} className="cal-wd">{w}</span>)}
        {cells.map((n, i) => {
          if (!n) return <span key={i} className="cal-cell empty" />;
          const k = keyOf(view.y, view.m, n), ok = free.has(k);
          return <button key={i} type="button" className={`cal-cell${ok ? " free" : ""}${k === todayKey ? " today" : ""}`} disabled={!ok} aria-pressed={ok ? k === value : undefined} aria-label={longDay(k)} onClick={() => onPick(k)}>{n}</button>;
        })}
      </div>
      <p className="cal-legend"><i aria-hidden="true" />{d.calLegend}</p>
      {!monthFree && free.size > 0 && (
        <p className="hint"><span>{d.calEmptyMonth}. </span>
          <button type="button" className="linklike" onClick={() => setView({ y: Number(firstFree.slice(0, 4)), m: Number(firstFree.slice(5, 7)) })}>{d.calNearest}</button></p>
      )}
    </div>
  );
}

const dayFmt = (loc: string, iso: string) => {
  const l = loc === "uk" ? "uk-UA" : loc === "ru" ? "ru-RU" : "en-IE";
  const dt = new Date(iso);
  return {
    wd: new Intl.DateTimeFormat(l, { timeZone: "Europe/Dublin", weekday: "short" }).format(dt),
    dn: new Intl.DateTimeFormat(l, { timeZone: "Europe/Dublin", day: "numeric" }).format(dt),
    mo: new Intl.DateTimeFormat(l, { timeZone: "Europe/Dublin", month: "short" }).format(dt),
    tm: new Intl.DateTimeFormat(l, { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(dt),
    full: new Intl.DateTimeFormat(l, { timeZone: "Europe/Dublin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(dt),
  };
};

export default function BookingFlow({ locale, d, services, initialSlug, mode = "book", manage }: {
  locale: "en" | "ru" | "uk"; d: Dict; services: Svc[]; initialSlug?: string; mode?: "book" | "reschedule";
  manage?: { id: string; token: string; serviceId: string };
}) {
  const first = services.find((s) => s.slug === initialSlug) ?? services[0];
  const [svc, setSvc] = useState<Svc | undefined>(mode === "reschedule" ? services.find((s) => s.id === manage?.serviceId) : initialSlug ? first : undefined);
  const [step, setStep] = useState<1 | 2 | 3>(mode === "reschedule" || initialSlug ? 2 : 1);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", service: false, marketing: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [moved, setMoved] = useState(false);
  const keyRef = useRef(newKey());
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!svc || step !== 2) return;
    setSlots(null); setErr("");
    fetch(api(`availability?serviceId=${svc.id}&days=${HORIZON}&locale=${locale}`)).then((r) => r.json()).then((j) => {
      setSlots(j.slots ?? []);
      const firstDay = j.slots?.[0] ? tzDay(j.slots[0].startUtc) : "";
      setDay((cur) => cur || firstDay);
    }).catch(() => setSlots([]));
  }, [svc, step, locale]);
  useEffect(() => { head.current?.focus(); }, [step, done, moved]);

  const days = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) { const k = tzDay(s.startUtc); (m.get(k) ?? m.set(k, []).get(k)!).push(s); }
    return [...m.entries()];
  }, [slots]);
  const times = days.find(([k]) => k === day)?.[1] ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!svc || !slot || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(api("bookings"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        serviceId: svc.id, startsAtUtc: slot.startUtc, idempotencyKey: keyRef.current,
        client: { name: form.name, contact: form.contact, locale }, consentService: form.service, consentMarketing: form.marketing, source: { ...captureSource(), channel: "website" },
      }) });
      const j = await r.json();
      if (r.ok && j.status === "confirmed") setDone({ id: j.appointmentId, token: j.manageToken, startsAtUtc: j.startsAtUtc, delivery: j.confirmationDeliveryStatus });
      else if (j?.error?.code === "slot_taken" || j?.error?.code === "slot_unavailable") { setErr(d.errTaken); setStep(2); setSlot(null); keyRef.current = newKey(); setDay(""); }
      else if (j?.error?.code === "invalid") setErr(d.errInvalid);
      else setErr(d.errGeneric);
    } catch { setErr(d.errGeneric); }
    setBusy(false);
  }
  async function reschedule() {
    if (!slot || !manage || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(api(`bookings/${manage.id}/reschedule?token=${encodeURIComponent(manage.token)}`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAtUtc: slot.startUtc }) });
      if (r.ok) setMoved(true); else setErr(d.errTaken);
    } catch { setErr(d.errGeneric); }
    setBusy(false);
  }

  if (done) {
    const link = `${typeof location !== "undefined" ? location.origin : ""}/${locale}/manage/${done.id}?token=${done.token}`;
    return (
      <div className="panel" role="status">
        <h2 ref={head} tabIndex={-1}>{d.doneTitle}</h2>
        <p className="summary" style={{ marginTop: 14 }}>{svc?.title} · {dayFmt(locale, done.startsAtUtc).full}</p>
        <p>{d.doneText}</p>
        {done.delivery === "not_configured" && <p className="hint">{d.doneMail}</p>}
        <p style={{ marginTop: 16, fontWeight: 700 }}>{d.manageLink}</p>
        <div className="linkbox"><a href={link}>{link}</a></div>
      </div>
    );
  }
  if (moved) return <div className="panel" role="status"><h2 ref={head} tabIndex={-1}>{d.reschedDone}</h2><p style={{ marginTop: 10 }}>{slot && dayFmt(locale, slot.startUtc).full}</p></div>;

  const labels = mode === "book" ? [d.stepService, d.stepTime, d.stepDetails] : [d.stepTime];
  const cur = mode === "book" ? step : 1;
  return (
    <div>
      <ol className="crumbs" aria-label="progress">{labels.map((l, i) => <li key={l} aria-current={i + 1 === cur ? "step" : undefined}>{i + 1}. {l}</li>)}</ol>
      {err && <p className="msg-error" role="alert">{err}</p>}

      {step === 1 && mode === "book" && (
        <div className="panel">
          <h2 ref={head} tabIndex={-1} style={{ fontSize: 30, marginBottom: 14 }}>{d.stepService}</h2>
          <div className="opts">
            {services.map((s) => (
              <button key={s.id} type="button" className="opt" aria-pressed={svc?.id === s.id} onClick={() => { setSvc(s); setDay(""); setSlot(null); }}>
                <b>{s.title}</b><span>{s.duration} {d.minutes}</span>
              </button>
            ))}
          </div>
          <div className="row"><button className="btn btn-primary" type="button" disabled={!svc} onClick={() => setStep(2)}>{d.next}</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="panel">
          <h2 ref={head} tabIndex={-1} style={{ fontSize: 30, marginBottom: 6 }}>{svc?.title}</h2>
          <p className="hint" style={{ marginTop: 0 }}>{d.timesNote}</p>
          {slots === null && <p className="hint" role="status">{d.loadingSlots}</p>}
          {slots && slots.length === 0 && <p className="msg-error">{d.noSlots}</p>}
          {days.length > 0 && (<>
            <div className="book-cal">
              <div>
                <p className="cal-label">{d.pickDay}</p>
                <Calendar locale={locale} d={d} free={new Set(days.map(([k]) => k))} value={day} onPick={(k) => { setDay(k); setSlot(null); setTimeout(() => document.getElementById("times-box")?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 50); }} />
              </div>
              <div id="times-box" className="times-box">
                <p className="cal-label">{d.pickTime}{day && <span className="cal-picked"> · {new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-IE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(day + "T00:00:00Z"))}</span>}</p>
                <div className="times" role="group" aria-label={d.pickTime}>
                  {times.map((s) => <button key={s.startUtc} type="button" className="time" aria-pressed={slot?.startUtc === s.startUtc} onClick={() => setSlot(s)}>{dayFmt(locale, s.startUtc).tm}</button>)}
                </div>
              </div>
            </div>
          </>)}
          <div className="row">
            {mode === "book" && <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>{d.back}</button>}
            {mode === "book"
              ? <button className="btn btn-primary" type="button" disabled={!slot} onClick={() => setStep(3)}>{d.next}</button>
              : <button className="btn btn-primary" type="button" disabled={!slot || busy} onClick={reschedule}>{busy ? d.saving : d.reschedBtn}</button>}
          </div>
        </div>
      )}

      {step === 3 && mode === "book" && svc && slot && (
        <form className="panel" onSubmit={submit}>
          <h2 ref={head} tabIndex={-1} style={{ fontSize: 30, marginBottom: 14 }}>{d.stepDetails}</h2>
          <p className="summary">{svc.title} · {dayFmt(locale, slot.startUtc).full}</p>
          <div className="field"><label htmlFor="n">{d.name}</label><input id="n" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} /></div>
          <div className="field"><label htmlFor="c">{d.contact}</label><input id="c" required autoComplete="email" inputMode="email" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={120} /></div>
          <label className="check"><input type="checkbox" checked={form.service} onChange={(e) => setForm({ ...form, service: e.target.checked })} /><span>{d.consentService}</span></label>
          <label className="check"><input type="checkbox" checked={form.marketing} onChange={(e) => setForm({ ...form, marketing: e.target.checked })} /><span>{d.consentMarketing}</span></label>
          <div className="row">
            <button className="btn btn-secondary" type="button" onClick={() => setStep(2)}>{d.back}</button>
            <button className="btn btn-primary" type="submit" disabled={busy || !form.service}>{busy ? d.saving : d.confirmBtn}</button>
          </div>
        </form>
      )}
    </div>
  );
}
