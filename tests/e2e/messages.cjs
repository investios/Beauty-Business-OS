// PR3: сообщения клиентам в пробном режиме: прогон, журнал, сброс, доступность, телефон.
const fs = require("fs");
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const nextDow = (dow, weeks) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((dow - d.getUTCDay() + 7) % 7 || 7) + 7 * weeks); return d; };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile390", { width: 390, height: 844 }], ["mobile320", { width: 320, height: 640 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    await p.goto(BASE + "/owner/login"); await p.fill("#pw", process.env.OWNER_PW || "demo-owner"); await p.getByRole("button", { name: "Войти" }).click(); await p.waitForURL("**/owner/today");
    if (name === "desktop") {
      const d = nextDow(3, 1 + Math.floor(Math.random() * 20)), day = d.toISOString().slice(0, 10), who = `Рассылка${Date.now() % 100000}`;
      await p.goto(BASE + "/owner/schedule");
      const f = p.locator('form:has(input[name="contact"]):has(select[name="service"])').last();
      await f.locator('input[name="day"]').fill(day); await f.locator('input[name="time"]').fill(`1${Math.floor(Math.random() * 7)}:${String(10 + Math.floor(Math.random() * 49))}`); await f.locator('input[name="name"]').fill(who);
      await f.locator('input[name="contact"]').fill(`${who}@example.com`); await f.locator('input[name="consent"]').check(); await f.locator('input[name="test"]').check();
      await f.getByRole("button", { name: "Записать" }).click(); await p.waitForSelector("text=Клиент записан");
      await p.goto(BASE + "/owner/messages", { waitUntil: "networkidle" });
      ok(await p.getByText("Пробный режим").count() > 0, "страница сообщает, что режим пробный и письма не уходят");
      ok(await p.locator("details", { hasText: "Напоминание за сутки" }).count() > 0, "шаблоны показаны");
      ok(await p.locator("section", { hasText: "Ждут своего срока" }).locator("li").count() > 0, "очередь напоминаний не пуста");
      // прогон на дату через 35 дней после визита с условием «визит состоялся»
      const after = new Date(d.getTime() + 35 * 86400000).toISOString().slice(0, 10);
      await p.fill('input[name="at"]', `${after}T12:00`); await p.check('input[name="assume"]');
      await p.getByRole("button", { name: "Прогнать сценарий" }).click(); await p.waitForURL(/m=ran/);
      ok(await p.locator("[role=status]").getByText("Никому ничего не отправлено").count() === 1, "после прогона явно сказано, что ничего не отправлено");
      const row = p.locator("details", { hasText: who });
      ok(await row.filter({ hasText: "Как прошёл визит" }).count() === 1, "создан текст «как прошёл визит»");
      await row.filter({ hasText: "Как прошёл визит" }).locator("summary").click();
      ok(await row.filter({ hasText: "Как прошёл визит" }).locator("pre").innerText().then((t) => t.includes(who) && !/token/i.test(t)), "текст содержит имя клиента и не содержит секретов");
      ok(await row.filter({ hasText: "Приглашение на повторный визит" }).filter({ hasText: "нет согласия на рекламные" }).count() === 1, "повторный визит пропущен: нет согласия на рекламу");
      if (SHOTS) await p.screenshot({ path: `${SHOTS}/messages.png`, fullPage: true });
      await p.getByRole("button", { name: "Сбросить результаты" }).click(); await p.waitForURL(/m=reset/);
      ok(await p.locator("details", { hasText: who }).filter({ hasText: "Как прошёл визит" }).count() === 0, "сброс очищает журнал пробных прогонов");
    }
    await p.goto(BASE + "/owner/messages", { waitUntil: "networkidle" });
    ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${name}: без горизонтальной прокрутки`);
    if (name !== "mobile320") {
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await axe.run("body", { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((x) => x.id + ":" + x.nodes[0].target.join(" ")));
      ok(v.length === 0, `${name}: axe ${v.join(" | ")}`);
    }
  }
  await b.close();
})().catch((e) => { console.log("FAIL " + e.message.split("\n")[0]); process.exit(1); });
