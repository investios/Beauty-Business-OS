// Сквозной путь: сайт -> запись -> видна в CRM -> перенос/отмена владельцем -> клиент видит то же по своей ссылке.
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "ru-RU" });
  const p = await ctx.newPage();
  const id = Math.floor(Math.random() * 1e6), name = "Тест CRM " + id, mail = `crm.e2e.${id}@example.com`;
  // 1. клиент записывается на сайте
  await p.goto(BASE + "/ru/book?utm_source=crm_e2e", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Предварительная консультация/ }).click();
  await p.getByRole("button", { name: "Далее" }).click();
  await p.waitForSelector(".time");
  const t = (await p.locator(".time").first().innerText()).trim();
  await p.locator(".time").first().click();
  await p.getByRole("button", { name: "Далее" }).click();
  await p.fill("#n", name); await p.fill("#c", mail);
  await p.getByLabel(/Согласен\(на\)/).check();
  await p.getByRole("button", { name: "Подтвердить запись" }).click();
  await p.waitForSelector("text=Время за вами");
  const link = await p.locator(".linkbox a").getAttribute("href");
  ok(true, "клиент записан на " + t);

  // 2. владелец видит запись
  const o = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await o.goto(BASE + "/owner/login"); await o.fill("#pw", process.env.OWNER_PW || "demo-owner"); await o.getByRole("button", { name: "Войти" }).click(); await o.waitForURL("**/owner/today");
  await o.goto(BASE + "/owner/appointments?q=" + encodeURIComponent(mail), { waitUntil: "networkidle" });
  ok(await o.locator(".item", { hasText: name }).count() === 1, "запись видна в CRM «Записи»");
  ok(await o.locator(".item", { hasText: "crm_e2e" }).count() === 1, "источник (utm) виден");
  await o.screenshot({ path: "tests/e2e/shots/crm_appointments.png" });
  await o.goto(BASE + "/owner/today", { waitUntil: "networkidle" });
  await o.screenshot({ path: "tests/e2e/shots/crm_overview.png", fullPage: true });
  await o.goto(BASE + "/owner/clients?q=" + encodeURIComponent(mail), { waitUntil: "networkidle" });
  ok(await o.locator(".item", { hasText: name }).count() >= 1, "клиент найден поиском");
  await o.goto(BASE + "/owner/appointments?q=" + encodeURIComponent(mail));
  await o.locator(".item", { hasText: name }).click(); await o.waitForURL("**/owner/appointments/*");
  await o.screenshot({ path: "tests/e2e/shots/crm_detail.png", fullPage: true });

  // 3. перенос владельцем на 17:15 через 3 недели
  const d = new Date(Date.now() + 21 * 86400000 + Math.floor(Math.random() * 5) * 86400000).toISOString().slice(0, 10);
  const mm = String(10 + Math.floor(Math.random() * 40));
  await o.fill('input[name="day"]', d); await o.fill('input[name="time"]', "17:" + mm);
  await o.getByRole("button", { name: "Перенести" }).click(); await o.waitForSelector("text=Запись перенесена");
  ok(true, "владелец перенёс на 17:" + mm);
  await p.goto(link, { waitUntil: "networkidle" });
  ok((await p.locator("body").innerText()).includes("17:" + mm), "клиент по своей ссылке видит новое время 17:" + mm);

  // 4. отмена владельцем
  await o.getByRole("button", { name: "Отменить запись" }).click(); await o.waitForSelector("text=Запись отменена");
  await p.goto(link, { waitUntil: "networkidle" });
  ok(/отменен/i.test(await p.locator("body").innerText()), "клиент видит, что запись отменена");
  await o.goto(BASE + "/owner/appointments?f=cancelled&q=" + encodeURIComponent(mail));
  ok(await o.locator(".item", { hasText: name }).count() === 1, "в CRM запись в «Отменённых»");

  // 5. закрытые API без входа
  const r = await fetch(BASE + "/owner/appointments", { redirect: "manual" });
  ok([302, 303, 307, 308].includes(r.status), "/owner/appointments без входа перенаправляет на логин (" + r.status + ")");
  await b.close();
})();
