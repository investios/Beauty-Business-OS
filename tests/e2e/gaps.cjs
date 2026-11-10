// Поиск пустых мест: (1) большие вертикальные разрывы между содержательными блоками, (2) пустота рядом с небольшой картинкой.
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PAGES = ["", "/about", "/services", "/services/extensions", "/services/trichology", "/services/recovery", "/services/care", "/services/consultation", "/library", "/library/why-hair-falls-out", "/results", "/contact", "/privacy"];
const VPS = [[320, 700, 120, 2], [390, 844, 120, 2], [430, 932, 120, 2], [768, 1024, 150, 2], [1440, 900, 200, 3]];
(async () => {
  const b = await chromium.launch(); const bad = []; let n = 0;
  for (const lang of ["ru", "en", "uk"]) for (const [w, h, gapMax] of VPS) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    for (const u of PAGES) {
      n++;
      await page.goto(`${BASE}/${lang}${u}`, { waitUntil: "networkidle" });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
      const r = await page.evaluate((gapMax) => {
        const vis = (e) => { const c = getComputedStyle(e), b = e.getBoundingClientRect(); return c.visibility !== "hidden" && c.display !== "none" && b.width > 2 && b.height > 2 && !e.closest(".chat-panel, .sticky, .chat-fab, [aria-hidden=true]:not(.lx-name)") && c.position !== "fixed"; };
        const sel = "h1,h2,h3,p,li,summary,a,button,select,img,input,.tile,.cal-grid,.art-card,figure,.wordmark,.chips,.filters";
        const boxes = [...document.querySelectorAll(sel)].filter(vis).filter((e) => !(e.closest("header.site-header")))
          .map((e) => { const b = e.getBoundingClientRect(); return { t: b.top + scrollY, b: b.bottom + scrollY, l: b.left, r: b.right, tag: e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""), txt: (e.textContent || "").trim().slice(0, 30) }; })
          .sort((a, b) => a.t - b.t);
        const out = []; let cover = 0, prev = null;
        for (const x of boxes) { if (x.t - cover > gapMax && prev) out.push(`разрыв ${Math.round(x.t - cover)}px над «${x.txt || x.tag}» (y=${Math.round(x.t)}) после «${prev.txt || prev.tag}»`); if (x.b > cover) { cover = x.b; prev = x; } }
        const vw = innerWidth;
        for (const img of document.querySelectorAll("img")) {
          if (!vis(img)) continue; const bi = img.getBoundingClientRect(); const fig = img.closest("figure") || img; const bf = fig.getBoundingClientRect();
          if (bf.width > vw * 0.62 || bf.height < 60) continue;
          const row = boxes.filter((x) => x.tag !== "img" && !x.tag.startsWith("figure") && x.b > bf.top + scrollY + 10 && x.t < bf.bottom + scrollY - 10 && x.l >= bf.right - 2);
          const lines = []; for (const e of document.querySelectorAll("h1,h2,h3,p,li,a.link-ul,a.btn")) { if (!vis(e)) continue; const rg = document.createRange(); rg.selectNodeContents(e); for (const q of rg.getClientRects()) if (q.width > 8) lines.push(q); }
          const beside = lines.some((q) => q.bottom > bf.top + 10 && q.top < bf.bottom - 10 && q.left >= bf.right - 4);
          const leftFree = vw - bf.right;
          if (!beside && leftFree > vw * 0.3 && !fig.closest(".tile, .art-card, a")) out.push(`пусто рядом с картинкой (${Math.round(bf.width)}px, справа ${Math.round(leftFree)}px свободно) y=${Math.round(bf.top + scrollY)}`);
        }
        return out;
      }, gapMax);
      for (const m of r) bad.push(`${lang}/${w} ${u || "/"}: ${m}`);
    }
    await page.close();
  }
  await b.close();
  console.log(`проверено: ${n}; найдено пустот: ${bad.length}`); [...new Set(bad)].slice(0, 60).forEach((m) => console.log("  " + m));
  process.exit(bad.length ? 1 : 0);
})();
