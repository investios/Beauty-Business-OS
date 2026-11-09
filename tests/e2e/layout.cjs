const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const widths = [320, 360, 375, 390, 430, 768, 1024, 1440];
const pages = ["/en", "/ru", "/uk", "/ru/book", "/uk/book", "/en/privacy"];
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w >= 1024 ? 900 : 800 }, deviceScaleFactor: w >= 1024 ? 1 : 2 });
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(BASE + p, { waitUntil: "networkidle" });
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (b.width && !(el.classList && el.classList.contains("skip")) && (b.right > vw + 1 || b.left < -1)) {
            // элементы внутри горизонтально прокручиваемых контейнеров не считаем
            let p = el.parentElement, scroll = false;
            while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll") { scroll = true; break; } p = p.parentElement; }
            if (!scroll) bad.push(el.tagName + "." + (el.className || "") + " " + Math.round(b.left) + "→" + Math.round(b.right));
          }
        }
        const small = [...document.querySelectorAll("a,button,input,summary")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.height && (b.height < 44 - 0.5) && getComputedStyle(e).visibility !== "hidden" && !e.classList.contains("skip") && e.tagName !== "INPUT" && !(e.tagName === "A" && e.closest("p,li,.final,.site-footer,.linkbox")); }).map((e) => e.tagName + "." + e.className + " h=" + Math.round(e.getBoundingClientRect().height));
        return { hscroll: document.documentElement.scrollWidth > vw, bad: bad.slice(0, 5), small: small.slice(0, 5) };
      });
      if (r.hscroll || r.bad.length || r.small.length) out.push({ w, p, ...r });
      if ([375, 1440].includes(w) && ["/ru", "/ru/book"].includes(p)) await page.screenshot({ path: `tests/e2e/shots/${w}${p.replace(/\//g, "_")}.png`, fullPage: true });
      if (w === 390) {
        await page.addScriptTag({ content: AXE });
        const a = await page.evaluate(async () => { const r = await axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }); return r.violations.map((v) => `${v.impact}:${v.id}:${v.nodes.length}`); });
        if (a.length) out.push({ w, p, axe: a });
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
  console.log("layout checks done:", widths.length * pages.length, "page-width combos");
})();
