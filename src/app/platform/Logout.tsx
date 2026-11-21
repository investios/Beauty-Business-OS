"use client";
export default function ConsultantLogout() {
  return <a href="/platform/login" onClick={async (e) => { e.preventDefault(); await fetch("/api/v1/platform/login", { method: "DELETE" }); location.href = "/platform/login"; }}>Выйти</a>;
}
