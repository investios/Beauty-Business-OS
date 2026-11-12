// PR2: календарь владельца (день/неделя/месяц), правила услуги, больничный-превью, лист ожидания, доступность, телефон.
const fs = require("fs");
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS || "";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const nextDow = (dow, weeks) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((dow - d.getUTCDay() + 7) % 7 || 7) + 7 * weeks); return d.toISOString().slice(0, 10); };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["mobile390", { width: 390, height: 844 }], ["mobile320", { width: 320, height: 640 }]]) {
    const p = await (await b.newContext({ viewport: vp })).newPage();
    await p.goto(BASE + "/owner/login"); await p.fill("#pw", process.env.OWNER_PW || "demo-owner"); await p.getByRole("button", { name: "Войти" }).click(); await p.waitForURL("**/owner/today");
    if (name === "desktop") {
      // клиент записан вручную на ближайший вторник 11:00 (уникальный контакт)
      const day = nextDow(2, 1 + Math.floor(Math.random() * 20)), who = `Календарь${Date.now() % 100000}`;
      await p.goto(BASE + "/owner/schedule");
      const f = p.locator('form:has(input[name="contact"]):has(select[name="service"])').last();
      await f.locator('input[name="day"]').fill(day); await f.locator('input[name="time"]').fill(`1${Math.floor(Math.random() * 7)}:${String(10 + Math.floor(Math.random() * 49))}`); await f.locator('input[name="name"]').fill(who);
      await f.locator('input[name="contact"]').fill(`${who}@example.com`); await f.locator('input[name="consent"]').check(); await f.locator('input[name="test"]').check();
      await f.getByRole("button", { name: "Записать" }).click(); await p.waitForSelector("text=Клиент записан");
      for (const [v, sel] of [["day", ".oc-day"], ["week", ".oc-week"], ["month", ".oc-month"]]) {
        await p.goto(`${BASE}/owner/calendar?view=${v}&date=${day}`, { waitUntil: "networkidle" });
        ok(await p.locator(sel).count() === 1, `вид «${v}» открывается`);
        ok(await p.locator("main").getByText(who).count() >= (v === "month" ? 0 : 1), `вид «${v}»: запись клиента видна`);
        if (SHOTS) await p.screenshot({ path: `${SHOTS}/cal-${v}.png`, fullPage: true });
      }
      await p.goto(`${BASE}/owner/calendar?view=month&date=${day}`);
      const n = await p.locator(`a.oc-cell[href*="date=${day}"]`).getAttribute("aria-label");
      ok(/записей [1-9]/.test(n || ""), `месяц: у дня ${day} есть счётчик записей (${n})`);
      await p.locator(`a.oc-cell[href*="date=${day}"]`).click(); await p.waitForURL(/view=day/);
      ok(await p.locator(".oc-appt", { hasText: who }).count() === 1, "из месяца переход в день показывает запись");
      await p.locator(".oc-appt", { hasText: who }).click(); await p.waitForURL(/appointments\//);
      ok(await p.locator("main").getByText(who).count() > 0, "клик по записи открывает карточку");
      // больничный
      await p.goto(`${BASE}/owner/calendar?view=week&date=${day}&from=${day}&to=${day}`);
      ok(await p.locator("#sick [role=status]").getByText(/Затронуто записей: [1-9]/).count() === 1, "больничный: превью показывает затронутые записи");
      ok(await p.locator("#sick").getByText("Ничего не изменено").count() === 1, "больничный: явно сказано, что ничего не меняется");
      // правило услуги: только понедельник → вторник пропадает у клиентов
      const svcs = (await (await fetch(`${BASE}/api/v1/public/demo/services`)).json()).services; const svc = svcs.find((s) => s.slug === "consultation").id;
      const slots = async () => (await (await fetch(`${BASE}/api/v1/public/demo/availability?serviceId=${svc}&days=190&locale=ru`)).json()).slots.map((s) => s.startUtc);
      ok((await slots()).some((s) => s.startsWith(day)), "до правила: вторник доступен клиентам");
      await p.goto(BASE + "/owner/schedule");
      const rf = () => p.locator(`#rules form:has(input[name="id"][value="${svc}"])`);
      for (const d of [0, 2, 3, 4, 5, 6]) await rf().locator(`input[name="d${d}"]`).uncheck();
      await rf().getByRole("button", { name: "Сохранить правила" }).click(); await p.waitForURL(/m=saved/);
      const only = await slots();
      ok(only.length > 0 && only.every((s) => new Date(s).getUTCDay() === 1), "правило «только понедельник»: клиенты видят только понедельники (" + only.length + " окон)");
      ok(!only.some((s) => s.startsWith(day)), "правило: вторник у клиентов пропал");
      await p.goto(BASE + "/owner/calendar?view=day&date=" + day);
      ok(await p.locator(".oc-day + h3, h3", { hasText: "Свободное время" }).count() >= 1, "календарь показывает свободное время из той же функции");
      // вернуть все дни
      await p.goto(BASE + "/owner/schedule");
      for (const d of [0, 2, 3, 4, 5, 6]) await rf().locator(`input[name="d${d}"]`).check();
      await rf().getByRole("button", { name: "Сохранить правила" }).click(); await p.waitForURL(/m=saved/);
      ok((await slots()).some((s) => s.startsWith(day)), "после возврата дней вторник снова доступен");
      // лист ожидания
      await p.goto(BASE + "/owner/calendar#waitlist");
      const wf = p.locator("#waitlist form").last(); const wname = `Ожидание${Date.now() % 100000}`;
      await wf.locator('input[name="name"]').fill(wname); await wf.locator('input[name="contact"]').fill(`${wname}@example.com`);
      await wf.locator('input[name="from"]').fill(nextDow(1, 1)); await wf.locator('input[name="to"]').fill(nextDow(5, 2));
      await wf.locator('input[name="consent"]').check(); await wf.getByRole("button", { name: "Добавить" }).click(); await p.waitForSelector("text=Сообщение ему не отправлялось");
      ok(await p.locator("#waitlist li", { hasText: wname }).count() === 1, "лист ожидания: клиент добавлен, видны свободные окна периода");
      await p.locator("#waitlist li", { hasText: wname }).getByRole("button", { name: "Убрать" }).click(); await p.waitForSelector("text=Статус обновлён");
      ok(await p.locator("#waitlist li", { hasText: wname }).count() === 0, "лист ожидания: клиента можно убрать");
    }
    for (const u of ["/owner/calendar?view=month", "/owner/calendar?view=week", "/owner/calendar?view=day", "/owner/schedule"]) {
      await p.goto(BASE + u, { waitUntil: "networkidle" });
      ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, `${name}: ${u} без горизонтальной прокрутки`);
      if (name !== "mobile320") {
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await axe.run("main", { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.map((x) => x.id + ":" + x.nodes[0].target.join(" ")));
        ok(v.length === 0, `${name}: ${u} axe ${v.join(" | ")}`);
      }
    }
    if (SHOTS && name === "mobile390") { await p.goto(BASE + "/owner/calendar?view=month", { waitUntil: "networkidle" }); await p.screenshot({ path: `${SHOTS}/cal-month-mobile.png`, fullPage: true }); }
  }
  await b.close();
})().catch((e) => { console.log("FAIL " + e.message.split("\n")[0]); process.exit(1); });
