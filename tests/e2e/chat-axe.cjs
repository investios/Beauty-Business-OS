// Доступность и контраст открытого чата на страницах макетов.
const { chromium } = require("playwright"); const fs = require("fs");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3100";
(async () => { const b = await chromium.launch(); const out = [];
  for (const v of (process.env.THEMES || "a,b,c,b1,b2,b3,d1,d2,d3").split(",")) for (const w of [375, 1440]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 } });
    await p.goto(`${BASE}/concepts/${v}?lang=ru`, { waitUntil: "networkidle" });
    const btns = p.getByRole("button", { name: "Проконсультироваться" });
    for (let i = 0; i < await btns.count(); i++) if (await btns.nth(i).isVisible()) { await btns.nth(i).click(); break; }
    await p.waitForSelector(".bubble.bot", { timeout: 40000 });
    await p.locator(".chat-input input").fill("Сколько стоит?"); await p.locator(".chat-input button[type=submit]").click();
    await p.waitForFunction(() => document.querySelectorAll(".bubble.bot").length > 1, null, { timeout: 40000 });
    await p.addScriptTag({ content: AXE });
    const ax = await p.evaluate(async () => (await axe.run(".chat-panel", { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((x) => x.id + ":" + x.nodes[0].target.join(" ")));
    if (ax.length) out.push({ v, w, ax });
    if (v === "d1" || v === "a") await p.screenshot({ path: `tests/e2e/shots-concepts/chat_${v}_${w}.png` });
    await p.close(); await new Promise((r) => setTimeout(r, 7000)); }
  await b.close(); console.log(JSON.stringify(out)); })();
