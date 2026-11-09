const { chromium } = require("playwright");
const fs = require("fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ru-RU" });
  const p = await ctx.newPage();
  const errors = []; p.on("pageerror", (e) => errors.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  // 1. прямая запись без ИИ, с UTM
  await p.goto(BASE + "/ru?utm_source=instagram&utm_campaign=hair-density", { waitUntil: "networkidle" });
  ok(await p.locator("h1").innerText() === "Индивидуальная работа с красотой ваших волос", "home H1 (no trailing dot)");
  await p.getByRole("link", { name: "Выбрать время" }).first().click();
  await p.waitForURL("**/ru/book");
  await p.getByRole("button", { name: /Предварительная консультация/ }).click();
  await p.getByRole("button", { name: "Далее" }).click();
  await p.waitForSelector(".time");
  await p.screenshot({ path: "tests/e2e/shots/390_book_time.png" });
  const firstTime = await p.locator(".time").first().innerText();
  await p.locator(".time").first().click();
  await p.getByRole("button", { name: "Далее" }).click();
  await p.fill("#n", "Анна Тест"); await p.fill("#c", "anna.test@example.com");
  const confirm = p.getByRole("button", { name: "Подтвердить запись" });
  ok(await confirm.isDisabled(), "confirm disabled until consent");
  await p.getByLabel(/Согласен\(на\)/).check();
  await p.screenshot({ path: "tests/e2e/shots/390_book_form.png" });
  await confirm.click();
  await p.waitForSelector("text=Время за вами");
  ok(true, "booking confirmed by server; first time " + firstTime);
  ok(await p.locator("text=Письма-подтверждения пока не подключены").count() === 1, "honest: email not connected notice");
  await p.screenshot({ path: "tests/e2e/shots/390_book_done.png" });
  const link = await p.locator(".linkbox a").getAttribute("href");

  // 2. управление записью по ссылке: чужой токен не работает
  const bad = await p.goto(link.replace(/token=.*/, "token=wrongtoken123"), { waitUntil: "networkidle" });
  ok(await p.locator("text=Запись не найдена").count() === 1, "wrong token shows not found");
  await p.goto(link, { waitUntil: "networkidle" });
  ok(await p.locator("text=Ваша запись").count() > 0, "manage page opens with right token");
  await p.screenshot({ path: "tests/e2e/shots/390_manage.png", fullPage: true });

  // 3. чат: цена без выдумки, запись на пятницу, медицинский вопрос
  await p.goto(BASE + "/ru?utm_source=tiktok", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Задать вопрос" }).first().click();
  await p.waitForSelector(".bubble.bot");
  ok((await p.locator(".bubble.bot").first().innerText()).includes("ИИ-ассистент"), "AI disclosure shown first");
  const say = async (t) => { await p.fill(".chat-input input", t); await p.keyboard.press("Enter"); await p.waitForTimeout(700); };
  await say("Сколько стоит?");
  let txt = await p.locator(".bubble.bot").last().innerText();
  ok(!/€|евро|\d{2,}/i.test(txt) && /не подтвержд/.test(txt), "price: no invented amount");
  await say("Хочу записаться на пятницу");
  await p.waitForSelector(".chat-slots button");
  const nSlots = await p.locator(".chat-slots button").count();
  ok(nSlots > 0, "chat shows real slots: " + nSlots);
  await p.screenshot({ path: "tests/e2e/shots/390_chat_slots.png" });
  await p.locator(".chat-slots button").first().click();
  await p.locator('.chat-form input[type="text"]').nth(0).fill("Мария Чат");
  await p.locator('.chat-form input[type="text"]').nth(1).fill("+353 87 123 4567");
  await p.locator('.chat-form input[type="checkbox"]').check();
  await p.getByRole("button", { name: "Подтвердить запись" }).click();
  await p.waitForSelector("text=Записано. Ваша личная ссылка");
  ok(true, "chat booking confirmed only after server OK");
  await say("После процедуры сильная реакция кожи и зуд");
  txt = await p.locator(".bubble.bot").last().innerText();
  ok(/не могу оценивать симптомы/.test(txt), "medical: safe escalation");
  await p.screenshot({ path: "tests/e2e/shots/390_chat_medical.png" });
  await p.getByRole("button", { name: "Закрыть" }).click();

  // 4. EN / UA тексты
  await p.goto(BASE + "/uk", { waitUntil: "networkidle" });
  ok((await p.locator("h1").innerText()).includes("красою"), "UA home");
  await p.goto(BASE + "/en", { waitUntil: "networkidle" });
  ok((await p.locator("h1").innerText()).startsWith("Individual work"), "EN home");
  ok(errors.length === 0, "no browser console errors " + JSON.stringify(errors.slice(0, 3)));
  await ctx.close();

  // 5. кабинет мастера (десктоп)
  const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await dctx.newPage();
  await d.goto(BASE + "/owner/today"); await d.waitForURL("**/owner/login");
  ok(true, "owner area redirects to login without session");
  await d.fill("#pw", "wrong"); await d.getByRole("button", { name: "Войти" }).click();
  await d.waitForSelector("text=Неверный пароль"); ok(true, "wrong password rejected");
  await d.fill("#pw", "test-owner-pass"); await d.getByRole("button", { name: "Войти" }).click();
  await d.waitForURL("**/owner/today");
  const today = await d.locator("main").innerText();
  ok(today.includes("Анна Тест") && today.includes("instagram"), "owner sees web booking with source instagram");
  ok(today.includes("Мария Чат"), "owner sees chat booking");
  await d.screenshot({ path: "tests/e2e/shots/1440_owner_today.png", fullPage: true });
  await d.goto(BASE + "/owner/ai"); 
  ok((await d.locator("main").innerText()).includes("медицинский вопрос"), "owner sees AI handoff (medical)");
  await d.screenshot({ path: "tests/e2e/shots/1440_owner_ai.png", fullPage: true });
  await d.goto(BASE + "/owner/marketing");
  const mk = await d.locator("main").innerText();
  ok(mk.includes("instagram") && mk.includes("tiktok") === false || mk.includes("instagram"), "marketing shows sources");
  await d.screenshot({ path: "tests/e2e/shots/1440_owner_marketing.png", fullPage: true });
  await d.goto(BASE + "/owner/clients"); await d.getByText("Анна Тест").click();
  ok((await d.locator("main").innerText()).includes("Обработка данных для записи"), "client card with consent");
  await d.screenshot({ path: "tests/e2e/shots/1440_owner_client.png", fullPage: true });
  await d.addScriptTag({ content: AXE });
  const ax = await d.evaluate(async () => (await axe.run({ runOnly: ["wcag2a", "wcag2aa"] })).violations.map((v) => v.id + ":" + v.nodes.length));
  ok(ax.length === 0, "owner client page axe clean " + JSON.stringify(ax));
  await dctx.close();
  // API без токена/сессии
  const r1 = await fetch(BASE + "/api/v1/public/demo/bookings/00000000-0000-4000-8000-000000000000?token=x"); ok(r1.status === 404, "API: unknown booking 404");
  const r2 = await fetch(BASE + "/owner/today", { redirect: "manual" }); ok([307, 308].includes(r2.status), "owner page without cookie redirects");
  const r3 = await fetch(BASE + "/api/v1/public/demo/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ serviceId: "x" }) }); ok(r3.status === 400, "API: invalid body 400");
  await b.close();
})();
