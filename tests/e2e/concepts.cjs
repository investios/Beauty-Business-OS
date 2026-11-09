// Проверка трёх макетов главной: горизонтальная прокрутка, вылезающие элементы, axe (контраст, доступность), скриншоты.
const { chromium } = require("playwright");
const fs = require("fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.env.OUT || "tests/e2e/shots-concepts";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const problems = [];
  for (const theme of (process.env.THEMES || "a,b,c,b1,b2,b3").split(",")) for (const lang of ["ru", "en", "uk"]) for (const [w, h, dsf] of [[320, 700, 1], [375, 800, 2], [768, 1000, 1], [1440, 900, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/concepts/${theme}?lang=${lang}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, bad = [];
      for (const el of document.querySelectorAll("body *")) {
        if (el.classList.contains("skip")) continue;
        const bb = el.getBoundingClientRect();
        if (bb.width && (bb.right > vw + 1 || bb.left < -1)) { let p = el.parentElement, sc = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { sc = true; break; } p = p.parentElement; } if (!sc) bad.push(el.tagName + "." + el.className + " " + Math.round(bb.left) + "→" + Math.round(bb.right)); }
      }
      const small = [...document.querySelectorAll("a,button,summary")].filter((e) => { const bb = e.getBoundingClientRect(); return bb.width && (bb.height < 32); }).map((e) => e.tagName + ":" + (e.textContent || "").trim().slice(0, 20)).slice(0, 4);
      return { hscroll: document.documentElement.scrollWidth > vw + 1, bad: bad.slice(0, 4), small };
    });
    await page.addScriptTag({ content: AXE });
    const ax = await page.evaluate(async () => (await axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((v) => `${v.id}:${v.nodes.length}:${v.nodes[0].target.join(" ")}`));
    if (r.hscroll || r.bad.length || r.small.length || ax.length) problems.push({ theme, lang, w, ...r, ax });
    if (lang === "ru" && [375, 1440].includes(w)) await page.screenshot({ path: `${OUT}/${theme}_${w}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
  console.log(JSON.stringify(problems, null, 1));
  console.log("concept checks done:", "all", "combos");
})();
