// PR1: плитки обзора кликабельны, цифра равна числу в списке, фильтр сохраняется при возврате, поиск, хронология, доступность, телефон.
const fs = require("fs");
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile390", { width: 390, height: 844 }], ["mobile320", { width: 320, height: 640 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    if (name === "desktop") {
      await p.goto(BASE + "/owner/login"); await p.fill("#pw", process.env.OWNER_PW || "demo-owner"); await p.getByRole("button", { name: "Войти" }).click(); await p.waitForURL("**/owner/today");
    } else {
      await p.goto(BASE + "/owner/login"); await p.fill("#pw", process.env.OWNER_PW || "demo-owner"); await p.getByRole("button", { name: "Войти" }).click(); await p.waitForURL("**/owner/today");
    }
    await p.goto(BASE + "/owner/today", { waitUntil: "networkidle" });
    const tiles = await p.locator("a.stat-link").count();
    ok(tiles >= 6, `${name}: на обзоре ${tiles} кликабельных плиток`);
    // плитка = список
    for (const f of ["today", "week", "new", "requested", "cancelled30"]) {
      await p.goto(BASE + "/owner/today", { waitUntil: "networkidle" });
      const tile = p.locator(`a.stat-link[href="/owner/appointments?f=${f}"]`);
      const n = parseInt(await tile.locator("b").innerText(), 10);
      await tile.click(); await p.waitForURL(`**f=${f}**`);
      const txt = await p.locator('p[role="status"]').innerText();
      const m = txt.match(/: (\d+)\./);
      ok(m && +m[1] === n, `${name}: плитка «${f}» = ${n}, в списке ${m && m[1]}`);
    }
    // переполнение и доступность
    for (const u of ["/owner/today", "/owner/appointments?f=week", "/owner/clients", "/owner/search?q=a", "/owner/schedule"]) {
      await p.goto(BASE + u, { waitUntil: "networkidle" });
      const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(sw <= 0, `${name}: ${u} без горизонтальной прокрутки`);
      if (name !== "mobile320") {
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await axe.run("main", { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((x) => x.id + ":" + x.nodes[0].target.join(" ")));
        ok(v.length === 0, `${name}: ${u} axe ${v.join(" | ")}`);
      }
    }
    if (name === "desktop") {
      // возврат с сохранением фильтра
      await p.goto(BASE + "/owner/appointments?f=all&q=%D0%A2", { waitUntil: "networkidle" });
      const first = p.locator("a.item").first();
      if (await first.count()) {
        await first.click(); await p.waitForURL("**/owner/appointments/*");
        await p.getByRole("link", { name: /Все записи/ }).click(); await p.waitForURL("**f=all**");
        ok(p.url().includes("f=all") && p.url().includes("q="), "возврат из записи сохраняет фильтр и поиск");
      }
      // из обзора возвращаемся в обзор
      await p.goto(BASE + "/owner/today", { waitUntil: "networkidle" });
      const row = p.locator("section a.item").first();
      if (await row.count()) { await row.click(); await p.waitForURL("**/owner/appointments/*"); await p.getByRole("link", { name: /Обзор/ }).first().click(); await p.waitForURL("**/owner/today"); ok(true, "возврат из записи на обзор"); }
      // общий поиск
      await p.goto(BASE + "/owner/today"); await p.fill('.owner-search input[name="q"]', "Тест"); await p.keyboard.press("Enter"); await p.waitForURL("**/owner/search?q=*");
      ok(await p.locator("a.item").count() > 0, "общий поиск находит клиентов или записи");
      // хронология клиента
      const cl = p.locator('a.item[href^="/owner/clients/"]').first();
      if (await cl.count()) { await cl.click(); await p.waitForURL("**/owner/clients/*"); ok(await p.getByRole("heading", { name: "Хронология" }).count() === 1, "карточка клиента с хронологией"); }
      await p.screenshot({ path: "tests/e2e/shots/pr1_client_timeline.png", fullPage: true });
      await p.goto(BASE + "/owner/today", { waitUntil: "networkidle" }); await p.screenshot({ path: "tests/e2e/shots/pr1_overview_desktop.png", fullPage: true });
    }
    if (name === "mobile390") { await p.goto(BASE + "/owner/today", { waitUntil: "networkidle" }); await p.screenshot({ path: "tests/e2e/shots/pr1_overview_390.png", fullPage: true }); }
  }
  // закрыто без входа
  const anon = await (await b.newContext()).newPage();
  for (const u of ["/owner/search?q=a", "/owner/appointments?f=all"]) { const r = await anon.request.get(BASE + u, { maxRedirects: 0 }); ok([302, 303, 307, 308].includes(r.status()), `${u} без входа: ${r.status()}`); }
  await b.close();
})();
