// Чат переживает переход между страницами, кнопка консультанта есть везде, при тишине консультант спрашивает про вопросы
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
let fails = 0; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) fails++; };
const settle = (p) => p.waitForFunction(() => !document.querySelector(".bubble.typing") && !document.querySelector(".chat-log [aria-hidden=true]") && !!document.querySelector(".chat-input button[type=submit]") && !document.querySelector(".chat-input button[type=submit]").disabled, null, { timeout: 60000 });
// единственная видимая в экране кнопка входа в чат (первый экран главной, нижняя кнопка или плавающая)
const CHROME = ".lx-hero [data-ask], .sticky [data-ask], .site-footer [data-ask], .chat-fab";
const tagAsk = (p) => p.evaluate((sel) => {
  document.querySelectorAll("[data-ask-target]").forEach((e) => e.removeAttribute("data-ask-target"));
  const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && cs.visibility !== "hidden" && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
  if (els.length) els[0].setAttribute("data-ask-target", "");
  return els.length;
}, CHROME);
const clickAsk = async (p) => { await p.waitForTimeout(350); const n = await tagAsk(p); if (n < 1) throw new Error("нет кнопки чата в экране"); await p.locator("[data-ask-target]").click(); };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 375, height: 800 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
    // кнопка есть на всех типах страниц
    for (const path of ["/ru", "/ru/services", "/ru/services/trichology", "/ru/library", "/ru/library/why-hair-falls-out", "/ru/about", "/ru/results", "/ru/contact", "/ru/book", "/uk", "/en/library"]) {
      await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(500);
      const n = await tagAsk(p);
      check(n === 1, `${name} ${path}: ровно одна кнопка входа в чат в экране (${n})`);
    }
    await p.goto(BASE + "/ru/services/trichology", { waitUntil: "networkidle" });
    await clickAsk(p);
    await p.waitForSelector(".bubble.bot"); await settle(p);
    await p.fill(".chat-input input", "Безопасно ли наращивание волос?"); await p.keyboard.press("Enter");
    await settle(p);
    const before = (await p.locator(".chat-log .bubble").allInnerTexts()).join("|");
    check(before.includes("Безопасно ли наращивание"), `${name}: вопрос задан`);
    // обычная ссылка: полная перезагрузка страницы
    await p.goto(BASE + "/ru/library", { waitUntil: "networkidle" });
    await p.waitForSelector(".chat-panel", { timeout: 10000 }).catch(() => {});
    check(await p.locator(".chat-panel").count() === 1, `${name}: после перехода чат остался открытым`);
    const after = (await p.locator(".chat-log .bubble").allInnerTexts()).join("|");
    check(after === before, `${name}: переписка сохранилась целиком`);
    // продолжение разговора в том же диалоге
    await p.fill(".chat-input input", "Сколько стоит?"); await p.keyboard.press("Enter"); await settle(p);
    const n = await p.locator(".chat-log .bubble.me").count();
    check(n === 2, `${name}: разговор продолжился после перехода (${n} вопроса)`);
    // закрыли чат и перешли — остаётся закрытым, но кнопка есть и история на месте
    await p.keyboard.press("Escape");
    await p.goto(BASE + "/ru/about", { waitUntil: "networkidle" });
    check(await p.locator(".chat-panel").count() === 0 && (await tagAsk(p)) === 1, `${name}: закрытый чат не открывается сам`);
    // другой язык: диалог начинается заново
    await p.goto(BASE + "/en", { waitUntil: "networkidle" });
    await clickAsk(p); await p.waitForSelector(".bubble.bot"); await settle(p);
    check(await p.locator(".chat-log .bubble.me").count() === 0, `${name}: при смене языка диалог новый`);
    await ctx.close();
  }
  // тишина → вопрос «остались ли вопросы»
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage();
  await p.clock.install();
  await p.goto(BASE + "/ru", { waitUntil: "networkidle" });
  await p.locator(".chat-fab").click(); await p.waitForSelector(".bubble.bot");
  await p.clock.runFor(8000); await settle(p).catch(() => {});
  const k0 = await p.locator(".bubble.bot").count();
  await p.clock.runFor(70000); await p.clock.runFor(8000);
  const k1 = await p.locator(".bubble.bot").count();
  const txt = (await p.locator(".chat-log").innerText());
  check(k1 > k0 && /Остались ли у вас ещё вопросы/.test(txt), "через минуту тишины консультант спрашивает, остались ли вопросы");
  await p.clock.runFor(130000);
  check((await p.locator(".chat-log").innerText()).split("Остались ли у вас ещё вопросы").length === 2, "вопрос задан только один раз");
  await b.close(); console.log("FAIL:", fails); process.exit(fails ? 1 : 0);
})();
