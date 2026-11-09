const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const pages = (process.env.PAGES || "/ru").split(",");
const sizes = (process.env.SIZES || "390,1440").split(",").map(Number);
(async () => {
  const b = await chromium.launch();
  for (const w of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    for (const u of pages) {
      await p.goto(BASE + u, { waitUntil: "networkidle" });
      await p.waitForTimeout(400);
      const name = u.replace(/[\/?=]/g, "_");
      await p.screenshot({ path: `tests/e2e/shots-lux/${w}${name}.png`, fullPage: true });
      console.log("shot", w, u);
    }
    await ctx.close();
  }
  await b.close();
})();
