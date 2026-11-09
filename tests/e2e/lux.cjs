// Проверка новых страниц: нет горизонтального переполнения, нет нарушений axe (WCAG AA), один H1, меню на телефоне, нет ошибок консоли.
const { chromium } = require("playwright");
const fs = require("fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PAGES = ["", "/about", "/services", "/services/extensions", "/services/trichology", "/services/recovery", "/services/care", "/services/consultation", "/library", "/library/why-hair-falls-out", "/library/normal-shedding-when-to-seek-advice", "/library/can-extensions-damage-your-hair", "/results", "/contact", "/privacy", "/book"];
const LANGS = (process.env.LANGS || "ru,en,uk").split(",");
const WIDTHS = [375, 768, 1440];
let fails = 0; const bad = (m) => { fails++; console.log("FAIL " + m); };
(async () => {
  const b = await chromium.launch(); let n = 0;
  for (const w of WIDTHS) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage(); const errs = [];
    p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    for (const l of LANGS) for (const u of PAGES) {
      const url = `/${l}${u}`; n++;
      const r = await p.goto(BASE + url, { waitUntil: "networkidle" });
      if (!r || r.status() !== 200) { bad(`${w} ${url} status ${r && r.status()}`); continue; }
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ov > 0) bad(`${w} ${url} горизонтальное переполнение ${ov}px`);
      const h1 = await p.locator("h1").count(); if (h1 !== 1) bad(`${w} ${url} H1 = ${h1}`);
      const broken = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
      if (broken.length) bad(`${w} ${url} битые картинки ${broken}`);
      await p.addScriptTag({ content: AXE });
      const ax = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] }).then((x) => x.violations.map((v) => v.id + " " + v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | "))));
      if (ax.length) bad(`${w} ${url} axe: ${ax.join("; ")}`);
    }
    if (errs.length) bad(`${w} ошибки консоли: ${[...new Set(errs)].slice(0, 3).join(" || ")}`);
    if (w < 1020) {
      await p.goto(BASE + "/ru", { waitUntil: "networkidle" });
      const burger = p.getByRole("button", { name: "Меню" });
      await burger.click(); const vis = await p.locator("#mnav").isVisible();
      if (!vis) bad(`${w} меню не открылось`);
      await p.getByRole("link", { name: "Библиотека знаний" }).first().click(); await p.waitForURL("**/ru/library");
      console.log(`ok ${w} меню открывается и ведёт на библиотеку`);
    }
    await ctx.close();
  }
  await b.close();
  console.log(`проверено страниц: ${n}; ошибок: ${fails}`);
  process.exitCode = fails ? 1 : 0;
})();
