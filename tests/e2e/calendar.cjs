// Календарь записи: месячная сетка, листание, выбор дня и времени, без горизонтальной прокрутки, доступность
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const fails = [], ok = [];
const check = (c, m) => (c ? ok : fails).push(m);
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1440, 900]]) for (const lang of ["ru", "en", "uk"]) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    const tag = `${lang}/${w}`;
    try {
      await page.goto(`${BASE}/${lang}/book?service=consultation`, { waitUntil: "networkidle" });
      if (await page.locator(".opt").count()) { await page.locator(".opt").first().click(); await page.getByRole("button", { name: /^(Далее|Next|Далі)$/ }).click(); }
      await page.waitForSelector(".cal-grid", { timeout: 20000 });
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${tag}: нет горизонтальной прокрутки`);
      const free = page.locator(".cal-cell.free");
      check(await free.count() > 0, `${tag}: есть свободные дни`);
      const sz = await free.first().boundingBox();
      check(sz && sz.height >= 44 && sz.width >= 30, `${tag}: ячейка дня крупная (${Math.round(sz.width)}x${Math.round(sz.height)})`);
      const nav = await page.locator(".cal-nav").first().boundingBox();
      check(nav.width >= 44 && nav.height >= 44, `${tag}: кнопки месяцев крупные`);
      check(await page.locator(".cal-cell.free[aria-pressed=true]").count() === 1 && await page.locator(".time").count() > 0, `${tag}: ближайший свободный день выбран сразу, время видно`);
      await free.nth(1).click();
      await page.waitForSelector(".time");
      check(await page.locator(".time").count() > 0, `${tag}: после выбора дня видно время`);
      const next = page.getByRole("button", { name: /^(Далее|Next|Далі)$/ });
      check(await next.isDisabled(), `${tag}: «Далее» неактивна до выбора времени`);
      await page.locator(".time").first().click();
      check(await next.isEnabled(), `${tag}: «Далее» активна после выбора времени`);
      // листание вперёд до границы 4 месяцев
      let n = 0; const nx = page.locator(".cal-nav").nth(1);
      while (await nx.isEnabled() && n < 10) { await nx.click(); n++; }
      check(n >= 5 && n <= 7, `${tag}: можно листать вперёд примерно на полгода (${n})`);
      check(await page.locator(".cal-nav").first().isEnabled(), `${tag}: можно вернуться назад`);
      while (await page.locator(".cal-nav").first().isEnabled()) await page.locator(".cal-nav").first().click();
      check(await page.locator(".cal-nav").first().isDisabled(), `${tag}: в прошлое листать нельзя`);
      if (lang === "ru") { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `tests/e2e/shots-lux/cal-${w}.png` }); }
    } catch (e) { fails.push(`${tag}: ${String(e).split("\n")[0]}`); }
    await page.close();
  }
  await b.close();
  console.log(ok.length + " ok"); fails.forEach((f) => console.log("FAIL " + f)); console.log("FAIL: " + fails.length);
  process.exit(fails.length ? 1 : 0);
})();
