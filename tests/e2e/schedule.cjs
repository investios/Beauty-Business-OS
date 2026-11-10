// Кабинет «Расписание»: мастер сам открывает воскресенье, закрывает день, меняет часы и ставит клиента на 17:15; клиент это видит.
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const fails = [], ok = [];
const check = (c, m) => (c ? ok : fails).push(m);
const iso = (d) => d.toISOString().slice(0, 10);
const nextDow = (dow, weeks) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((dow - d.getUTCDay() + 7) % 7 || 7) + 7 * weeks); return d; };
const MIN = `17:${String(10 + Math.floor(Math.random() * 45))}`;
const SCHED = (base) => `${base}/owner/schedule`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await p.goto(`${BASE}/owner/login`); await p.fill("#pw", process.env.OWNER_PW || "demo-owner"); await p.getByRole("button", { name: "Войти" }).click(); await p.waitForURL("**/owner/today");
    await p.goto(`${BASE}/owner/schedule`);
    for (let i = 0; i < 40; i++) { const del = p.getByRole("button", { name: "Убрать" }).first(); if (!(await del.count())) break; await del.click(); await p.waitForLoadState("networkidle"); await p.goto(`${BASE}/owner/schedule`); } // чистое начало
    check(await p.locator("h1", { hasText: "Расписание" }).count() === 1, "раздел «Расписание» открывается");
    await p.getByRole("button", { name: /Вернуть стандартное/ }).click(); await p.waitForSelector("text=Стандартное расписание применено");
    check(await p.locator('input[name="on0"]').isChecked() === false && await p.locator('input[name="on1"]').isChecked(), "стандарт: воскресенье выходной, понедельник рабочий");
    // клиентская страница: воскресенье закрыто
    const sunday = iso(nextDow(0, 1 + Math.floor(Math.random() * 20)));
    const api = async () => (await (await fetch(`${BASE}/api/v1/public/demo/availability?serviceId=${svc}&days=190&locale=ru`)).json()).slots.map((s) => s.startUtc);
    const services = (await (await fetch(`${BASE}/api/v1/public/demo/services`)).json()).services; const svc = services.find((s) => s.slug === "consultation").id;
    check(!(await api()).some((s) => s.startsWith(sunday)), "по умолчанию в воскресенье записи нет");
    // мастер открывает воскресенье 10:00–12:00
    await p.goto(SCHED(BASE));
    await p.fill('form:has(select[name="kind"]) input[name="day"]', sunday); await p.selectOption('select[name="kind"]', "open");
    await p.fill('form:has(select[name="kind"]) input[name="from"]', "10:00"); await p.fill('form:has(select[name="kind"]) input[name="to"]', "12:00");
    await p.locator('form:has(select[name="kind"])').getByRole("button", { name: "Добавить" }).click(); await p.waitForSelector(`text=${sunday} · открыто`);
    const sun = (await api()).filter((s) => s.startsWith(sunday)).map((s) => s.slice(11, 16));
    check(sun.join() === "10:00,11:00", "после открытия воскресенья клиенты видят 10:00 и 11:00 (" + sun.join() + ")");
    // закрыть субботу не нужно; закрываем ближайшую среду целиком
    const wed = iso(nextDow(3, 1));
    check((await api()).some((s) => s.startsWith(wed)), "среда сначала рабочая");
    await p.goto(SCHED(BASE));
    await p.fill('form:has(select[name="kind"]) input[name="day"]', wed); await p.selectOption('select[name="kind"]', "closed");
    await p.fill('form:has(select[name="kind"]) input[name="from"]', ""); await p.fill('form:has(select[name="kind"]) input[name="to"]', "");
    await p.locator('form:has(select[name="kind"])').getByRole("button", { name: "Добавить" }).click(); await p.waitForSelector(`text=${wed} · выходной`);
    check(!(await api()).some((s) => s.startsWith(wed)), "после закрытия среда пропала у клиентов");
    // ручная запись воскресенье 17:15
    await p.goto(SCHED(BASE));
    const man = p.locator('form:has(select[name="service"])');
    await man.locator('input[name="day"]').fill(sunday); await man.locator('input[name="time"]').fill(MIN);
    await man.locator('input[name="name"]').fill("Тест Ручная"); await man.locator('input[name="contact"]').fill("manual@example.com"); await man.locator('input[name="consent"]').check();
    await man.getByRole("button", { name: "Записать" }).click(); await p.waitForSelector("text=Клиент записан");
    check(true, "мастер записал клиента на воскресенье 17:15");
    await p.goto(SCHED(BASE));
    await man.locator('input[name="day"]').fill(sunday); await man.locator('input[name="time"]').fill(MIN);
    await man.locator('input[name="name"]').fill("Тест Двойная"); await man.locator('input[name="contact"]').fill("dbl@example.com"); await man.locator('input[name="consent"]').check();
    await man.getByRole("button", { name: "Записать" }).click(); await p.waitForSelector("text=уже занято");
    check(true, "второй клиент на то же время отклонён");
    // календарь клиента: воскресенье подсвечено как свободное
    const c = await b.newPage({ viewport: { width: 390, height: 844 } });
    await c.goto(`${BASE}/ru/book?service=consultation`, { waitUntil: "networkidle" });
    if (await c.locator(".opt").count()) { await c.locator(".opt").first().click(); await c.getByRole("button", { name: /^Далее$/ }).click(); }
    await c.waitForSelector(".cal-grid");
    let found = false; for (let i = 0; i < 7 && !found; i++) { found = (await c.locator(`.cal-cell.free[aria-label*="воскресенье"]`).count()) > 0; if (!found) await c.locator(".cal-nav").nth(1).click(); }
    check(found, "в календаре клиента воскресенье подсвечено свободным");
    // убрать за собой: убрать исключения
    await p.goto(`${BASE}/owner/schedule`);
    for (let i = 0; i < 40; i++) { const del = p.getByRole("button", { name: "Убрать" }).first(); if (!(await del.count())) break; await del.click(); await p.waitForLoadState("networkidle"); await p.goto(`${BASE}/owner/schedule`); }
    check(await p.getByRole("button", { name: "Убрать" }).count() === 0, "исключения удаляются");
  } catch (e) { fails.push(String(e).split("\n")[0]); }
  await b.close();
  console.log(ok.length + " ok"); fails.forEach((f) => console.log("FAIL " + f)); console.log("FAIL: " + fails.length); process.exit(fails.length ? 1 : 0);
})();
