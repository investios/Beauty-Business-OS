"use client";
import { useState } from "react";
import type { Key } from "@/lib/i18n";
import { api } from "@/lib/client";
export default function CancelButton({ id, token, d }: { locale: string; id: string; token: string; d: Record<Key, string> }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "err" | "late">("idle");
  async function go() {
    setState("busy");
    try { const r = await fetch(api(`bookings/${id}/cancel?token=${encodeURIComponent(token)}`), { method: "POST" }); if (r.ok) setState("done"); else { const j = await r.json().catch(() => null); setState(r.status === 409 && j?.error?.code === "too_late" ? "late" : "err"); } }
    catch { setState("err"); }
  }
  if (state === "done") return <p className="msg-ok" role="status">{d.cancelled}</p>;
  return (<div>
    <button className="btn btn-secondary" type="button" onClick={go} disabled={state === "busy"}>{d.cancelBtn}</button>
    {state === "late" && <p className="msg-error" role="alert">{d.errLate}</p>}
    {state === "err" && <p className="msg-error" role="alert">{d.errGeneric}</p>}
  </div>);
}
