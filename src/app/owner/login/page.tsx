"use client";
import { useState } from "react";
export default function Login() {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await fetch("/api/v1/owner/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = "/owner/today"; else { setErr(r.status === 429 ? "Слишком много попыток, подождите 15 минут" : "Неверный пароль"); setBusy(false); }
  }
  return (
    <div className="page"><div className="wrap narrow">
      <h1 style={{ fontSize: 44, marginBottom: 20 }}>Кабинет мастера</h1>
      <form className="panel" onSubmit={go}>
        <div className="field"><label htmlFor="pw">Пароль</label><input id="pw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        {err && <p className="msg-error" role="alert">{err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>Войти</button>
      </form>
    </div></div>
  );
}
