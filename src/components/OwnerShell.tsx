import { redirect } from "next/navigation";
import { ownerTenant } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

const NAV = [["today", "Обзор"], ["appointments", "Записи"], ["clients", "Клиенты"], ["calendar", "Календарь"], ["schedule", "Расписание"], ["messages", "Сообщения"], ["ai", "ИИ и вопросы"], ["marketing", "Маркетинг"], ["library", "Библиотека"]] as const;

export default async function OwnerShell({ current, children }: { current: string; children: (t: { id: string; name: string; is_demo: boolean }) => Promise<React.ReactNode> | React.ReactNode }) {
  const tenant = await ownerTenant();
  if (!tenant) redirect("/owner/login");
  return (
    <div className="owner-shell">
      <header className="owner-top"><div className="wrap">
        <b>{tenant.name}</b>
        <nav className="owner-nav" aria-label="Разделы">
          {NAV.map(([k, l]) => <a key={k} href={`/owner/${k}`} aria-current={current === k ? "page" : undefined}>{l}</a>)}
          <LogoutButton />
        </nav>
        <form className="owner-search" role="search" action="/owner/search"><input type="search" name="q" placeholder="Поиск: имя, контакт, услуга" aria-label="Поиск по кабинету" /><button className="btn btn-secondary btn-sm" type="submit">Найти</button></form>
      </div></header>
      <main className="wrap owner-main">
        {tenant.is_demo && <p className="warnbox">Демо-режим: услуги, часы и тексты ИИ — заглушки. Реальные данные мастера пока не внесены.</p>}
        {await children(tenant)}
      </main>
    </div>
  );
}
