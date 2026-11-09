"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "@/lib/i18n";
import { api, captureSource, newKey, tzDay } from "@/lib/client";
type Dict = Record<Key, string>;
type Svc = { id: string; slug: string; title: string; desc: string; duration: number };
type Slot = { startUtc: string; endUtc: string; label: string };
type Done = { id: string; token: string; startsAtUtc: string; delivery: string };

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
    fetch(api(`availability?serviceId=${svc.id}&days=28&locale=${locale}`)).then((r) => r.json()).then((j) => {
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
            <p style={{ fontWeight: 700, color: "var(--plum)", margin: "14px 0 4px" }}>{d.pickDay}</p>
            <div className="days" role="group" aria-label={d.pickDay}>
              {days.map(([k, arr]) => { const f = dayFmt(locale, arr[0].startUtc); return (
                <button key={k} type="button" className="day" aria-pressed={k === day} onClick={() => { setDay(k); setSlot(null); }}><span>{f.wd}</span><b>{f.dn}</b><span>{f.mo}</span></button>
              ); })}
            </div>
            <p style={{ fontWeight: 700, color: "var(--plum)", margin: "10px 0 4px" }}>{d.pickTime}</p>
            <div className="times" role="group" aria-label={d.pickTime}>
              {times.map((s) => <button key={s.startUtc} type="button" className="time" aria-pressed={slot?.startUtc === s.startUtc} onClick={() => setSlot(s)}>{dayFmt(locale, s.startUtc).tm}</button>)}
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
