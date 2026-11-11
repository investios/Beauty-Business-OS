// Первый экран на телефоне: лицо, имя, оффер и главная кнопка видны без прокрутки; логотип не ломается; нижняя кнопка не мешает
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const VPS = [[320, 568], [360, 740], [375, 667], [390, 844], [430, 932]];
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };
(async () => {
  const b = await chromium.launch();
  for (const lang of ["ru", "en", "uk"]) for (const [w, h] of VPS) {
    const tag = `${lang} ${w}x${h}`;
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
    const m = await p.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height }; };
      const vis = (s) => [...document.querySelectorAll(s)].find((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden");
      const cta = vis(".lx-cta .btn-primary"), cal = vis(".lx-cta .btn-secondary");
      const sticky = document.querySelector(".sticky");
      return {
        vh: innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth,
        wm: box(".wordmark"), img: box(".lx-photo img"), name: box(".lx-name"), h1: box(".lx-quote"), svc: box(".lx-svc"),
        cta: cta && (({ top, bottom }) => ({ t: top, b: bottom }))(cta.getBoundingClientRect()),
        cal: cal && (({ top, bottom }) => ({ t: top, b: bottom }))(cal.getBoundingClientRect()),
        ctaText: cta?.textContent, stickyVisible: sticky && getComputedStyle(sticky).visibility !== "hidden",
      };
    });
    check(m.wm.h < 56, `${tag}: логотип в одну строку (высота ${Math.round(m.wm.h)})`);
    check(m.sw <= m.vw, `${tag}: нет горизонтальной прокрутки`);
    // лицо: верхние 55% кадра (лицо в верхней половине фото) видны целиком
    const faceBottom = m.img.t + m.img.h * 0.55;
    check(m.img.t >= 0 && faceBottom <= m.vh, `${tag}: лицо в первом экране (кадр ${Math.round(m.img.t)}–${Math.round(m.img.b)})`);
    check(m.name.b <= m.vh && m.name.t >= 0, `${tag}: имя видно`);
    check(m.h1.b <= m.vh, `${tag}: короткая цитата Милы видна, низ ${Math.round(m.h1.b)}`);
    check(m.svc.b <= m.vh, `${tag}: строка услуг видна`);
    check(m.cta && m.cta.b <= m.vh, `${tag}: главная кнопка видна целиком, низ ${m.cta && Math.round(m.cta.b)}`);
    check(m.cal && m.cal.b <= m.vh + 1, `${tag}: запасная запись (календарь) видна, низ ${m.cal && Math.round(m.cal.b)}`);
    check(!m.stickyVisible, `${tag}: нижняя кнопка скрыта на первом экране`);
    check(/(консульт|consult)/i.test(m.ctaText || ""), `${tag}: текст главной кнопки «${m.ctaText}»`);
    if (lang === "ru") await p.screenshot({ path: `tests/e2e/shots-lux/pr1-${w}x${h}.png` });
    // прокрутка: после ухода кнопок hero появляется ОДНА нижняя кнопка; у подвала скрыта
    await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(400);
    const mid = await p.evaluate(() => { const s = document.querySelector(".sticky"); return s && getComputedStyle(s).visibility !== "hidden" && s.querySelectorAll("button, a").length; });
    check(mid === 1, `${tag}: после прокрутки одна нижняя кнопка (${mid})`);
    await p.evaluate(() => window.scrollTo(0, 1e6)); await p.waitForTimeout(500);
    const foot = await p.evaluate(() => { const s = document.querySelector(".sticky"); return s && getComputedStyle(s).visibility !== "hidden"; });
    check(!foot, `${tag}: у подвала нижняя кнопка скрыта`);
    await p.close();
  }
  await b.close(); console.log("FAIL:", fails); process.exit(fails ? 1 : 0);
})();
