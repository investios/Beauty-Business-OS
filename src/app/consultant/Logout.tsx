"use client";
export default function ConsultantLogout() {
  return <a href="/consultant/login" onClick={async (e) => { e.preventDefault(); await fetch("/api/v1/consultant/login", { method: "DELETE" }); location.href = "/consultant/login"; }}>Выйти</a>;
}
