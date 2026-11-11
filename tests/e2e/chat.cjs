// Полный сценарий ИИ-консультанта: открытие, ответы на 3 языках, передача мастеру, закрытие, ошибка API, запись через чат.
// BASE_URL=... node tests/e2e/chat.cjs   (BOOK=1 — ещё и создать тестовую запись)
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const L = {
  ru: { ask: "Проконсультироваться", q: "Сколько стоит наращивание?", med: "У меня сильно выпадают волосы, что делать?", book: "Хочу записаться на консультацию", human: "Передано мастеру", booked: "Записано" },
  en: { ask: "Get a consultation", q: "How much do extensions cost?", med: "My hair is falling out a lot, what should I do?", book: "I want to book a consultation", human: "Passed to the specialist", booked: "Booked" },
  uk: { ask: "Проконсультуватися", q: "Скільки коштує нарощування?", med: "У мене сильно випадає волосся, що робити?", book: "Хочу записатися на консультацію", human: "Передано майстру", booked: "Записано" },
};
const fails = [], ok = [];
const check = (c, m) => (c ? ok : fails).push(m);
async function openChat(page, t) {
  // единственная видимая точка входа: кнопка первого экрана / нижняя кнопка на телефоне или плавающая кнопка на компьютере
  const b = page.locator("[data-ask]:visible, .chat-fab:visible").first();
  if (!(await b.count())) return false;
  await b.click(); return true;
}
async function say(page, text) {
  const before = await page.locator(".bubble.bot").count();
  await page.locator(".chat-input input").fill(text);
  await page.locator(".chat-input button[type=submit]").click();
  await page.waitForFunction((n) => document.querySelectorAll(".bubble.bot").length > n, before, { timeout: 40000 });
  await settle(page);
}
// ответ приходит по частям: ждём, пока исчезнет «печатает…» и снова станет доступна отправка
async function settle(page) {
  await page.waitForFunction(() => !document.querySelector(".bubble.typing") && !document.querySelector(".chat-log [aria-hidden=true]") && !document.querySelector(".chat-input button[type=submit]").disabled, null, { timeout: 40000 });
}
(async () => {
  const b = await chromium.launch();
  for (const lang of ["ru", "en", "uk"]) for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 375, height: 800 }]]) {
    const tag = `${lang}/${name}`, t = L[lang];
    const ctx = await b.newContext({ viewport: vp }); const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${(process.env.PAGE || "/{lang}").replace("{lang}", lang)}`, { waitUntil: "networkidle" });
      check(await openChat(page, t), `${tag}: кнопка «${t.ask}» видна и нажимается`);
      await page.waitForSelector(".chat-panel", { timeout: 30000 });
      await page.waitForSelector(".bubble.bot", { timeout: 40000 });
      await settle(page);
      check(true, `${tag}: чат открылся, есть приветствие`);
      // приветствие и ответы выходят по частям, а не одним блоком
      check(await page.locator(".bubble.typing").count() === 0, `${tag}: после ответа индикатор «печатает» убран`);
      const box = await page.locator(".chat-panel").boundingBox();
      check(box && box.x >= -1 && box.x + box.width <= vp.width + 1 && box.y >= -1 && box.y + box.height <= vp.height + 1, `${tag}: панель чата в границах экрана`);
      await say(page, t.q);
      const last = (await page.locator(".bubble.bot").last().innerText()).trim();
      check(last.length > 20, `${tag}: ответ на вопрос о цене получен`);
      await say(page, t.med);
      check(await page.getByText(t.human).first().isVisible(), `${tag}: сложный вопрос передан мастеру`);
      await page.keyboard.press("Escape");
      check(await page.locator(".chat-panel").count() === 0, `${tag}: Escape закрывает чат`);
      await openChat(page, t); await page.waitForSelector(".chat-panel");
      await page.getByRole("button", { name: /×|Закрыть|Close|Закрити/ }).first().click();
      check(await page.locator(".chat-panel").count() === 0, `${tag}: кнопка × закрывает чат`);
      if (process.env.BOOK && lang === "ru" && name === "desktop") {
        await openChat(page, t); await page.waitForSelector(".bubble.bot");
        await say(page, t.book);
        const slot = page.locator(".chat-slots button").first();
        check(await slot.count() > 0, `${tag}: чат показал свободное время`);
        await slot.click();
        await page.locator(".chat-form input[autocomplete=name]").fill("Тест Чата");
        await page.locator(".chat-form input[autocomplete=email]").fill("chat-test@example.com");
        await page.locator(".chat-form input[type=checkbox]").check();
        await page.locator(".chat-form button[type=submit]").click();
        await page.waitForFunction(() => /Записано/.test(document.querySelector(".chat-log")?.textContent || ""), null, { timeout: 40000 });
        const txt = await page.locator(".chat-log").innerText();
        const m = txt.match(/https?:\/\/\S+\/manage\/\S+/);
        check(!!m, `${tag}: запись через чат подтверждена, есть личная ссылка`);
        if (m) console.log("MANAGE_LINK", m[0]);
      }
      // ошибка API: чат не должен ломаться
      const ctx2 = await b.newContext({ viewport: vp }); const p2 = await ctx2.newPage();
      await p2.route("**/api/v1/**/ai/**", (r) => r.abort());
      await p2.goto(`${BASE}${(process.env.PAGE || "/{lang}").replace("{lang}", lang)}`, { waitUntil: "networkidle" });
      await openChat(p2, t); await p2.waitForSelector(".bubble.sys", { timeout: 30000 });
      check(true, `${tag}: при сбое API показано понятное сообщение`);
      await ctx2.close();
    } catch (e) { fails.push(`${tag}: ${String(e).split("\n")[0]} @ ${(e.stack||"").split("\n").find((l) => l.includes("chat.cjs"))}`); }
    await ctx.close();
    await new Promise((r) => setTimeout(r, 7000)); // лимит сервера: 10 новых диалогов в минуту с одного адреса
  }
  await b.close();
  console.log("OK:", ok.length); console.log(ok.join("\n")); console.log("FAIL:", fails.length); console.log(fails.join("\n"));
  process.exit(fails.length ? 1 : 0);
})();
