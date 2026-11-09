"use client";
export default function LogoutButton() {
  return <a href="/owner/login" onClick={async (e) => { e.preventDefault(); await fetch("/api/v1/owner/login", { method: "DELETE" }); location.href = "/owner/login"; }}>Выйти</a>;
}
