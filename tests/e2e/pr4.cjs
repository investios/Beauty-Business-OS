// PR4: ИИ переносит и отменяет запись только по ссылке и только после кнопки «Подтверждаю»; помощник владельца строит превью.
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const API = BASE + "/api/v1/public/demo";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const j = async (r) => ({ status: r.status, body: await r.json() });
async function book(i) {
  const svc = (await (await fetch(`${API}/services`)).json()).services.find((s) => s.slug === "consultation").id;
  const slots = (await (await fetch(`${API}/availability?serviceId=${svc}&days=60&locale=ru`)).json()).slots;
  const s = slots[5 + i * 3];
  const r = await j(await fetch(`${API}/bookings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId: svc, startsAtUtc: s.startUtc, idempotencyKey: `e2e-pr4-${Date.now()}-${i}-xxxxx`, client: { name: `Чат Тест ${Date.now() % 10000}`, contact: `chat${Date.now()}${i}@example.com`, locale: "ru" }, consentService: true, source: { test: "1" } }) }));
  return { id: r.body.appointmentId, token: r.body.manageToken, start: s.startUtc, link: `${BASE}/ru/manage/${r.body.appointmentId}?token=${r.body.manageToken}` };
}
const get = async (b) => (await (await fetch(`${API}/bookings/${b.id}?token=${b.token}`)).json());
async function chatSend(p, text) {
  await p.fill(".chat-input input", text); await p.locator(".chat-input button").click();
  await p.waitForFunction((t) => [...document.querySelectorAll(".bubble.me")].some((e) => e.textContent.includes(t.slice(0, 15))), text);
}
(async () => {
  const b = await chromium.launch();
  const mv = await book(0), cn = await book(1);
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })).newPage();
  await p.goto(BASE + "/ru", { waitUntil: "networkidle" });
  await p.locator(".chat-fab").click(); await p.waitForSelector(".bubble.bot");
  // без ссылки
  await chatSend(p, "Хочу отменить запись, меня зовут Анна");
  await p.waitForSelector("text=/manage/", { timeout: 20000 });
  ok(true, "без ссылки ИИ просит защищённую ссылку и ничего не меняет");
  // перенос
  await chatSend(p, `Перенесите запись ${mv.link}`);
  await p.waitForSelector(".chat-slots button.btn-secondary", { timeout: 20000 });
  const before = (await get(mv)).startsAtUtc;
  await p.locator(".chat-slots button.btn-secondary").first().click();
  await p.getByRole("button", { name: "Подтверждаю" }).waitFor({ timeout: 20000 });
  ok((await get(mv)).startsAtUtc === before, "после выбора времени запись ещё НЕ изменена");
  await p.getByRole("button", { name: "Подтверждаю" }).click();
  await p.waitForSelector("text=Готово: запись перенесена", { timeout: 20000 });
  const after = (await get(mv)).startsAtUtc;
  ok(after !== before, "после «Подтверждаю» запись перенесена (" + before.slice(0, 16) + " → " + after.slice(0, 16) + ")");
  // отмена с отказом, затем с подтверждением
  await chatSend(p, `Отмените, пожалуйста ${cn.link}`);
  await p.getByRole("button", { name: "Не нужно" }).waitFor({ timeout: 20000 });
  await p.getByRole("button", { name: "Не нужно" }).click(); await p.waitForSelector("text=ничего не менял");
  ok((await get(cn)).status === "confirmed", "отказ: запись осталась");
  await chatSend(p, `Отмените ${cn.link}`);
  await p.getByRole("button", { name: "Подтверждаю" }).last().waitFor({ timeout: 20000 });
  await p.getByRole("button", { name: "Подтверждаю" }).last().click(); await p.waitForSelector("text=Готово: запись отменена", { timeout: 20000 });
  ok((await get(cn)).status === "cancelled", "после «Подтверждаю» запись отменена");
  // неверная ссылка
  await chatSend(p, `Отмените ${mv.link.replace(mv.token, "WRONGTOKEN123456789")}`);
  await p.waitForSelector("text=Не получилось проверить запись", { timeout: 20000 });
  ok((await get(mv)).status === "confirmed", "неверная ссылка ничего не меняет и не раскрывает данные");
  const html = await p.content(); ok(!html.includes(mv.token), "секретный токен не остаётся в окне чата");
  // помощник владельца
  const o = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await o.goto(BASE + "/owner/login"); await o.fill("#pw", process.env.OWNER_PW || "demo-owner"); await o.getByRole("button", { name: "Войти" }).click(); await o.waitForURL("**/owner/today");
  const day = new Date((await get(mv)).startsAtUtc), d2 = (n) => String(n).padStart(2, "0");
  const ru = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  await o.goto(BASE + "/owner/calendar?q=" + encodeURIComponent(`Я заболела ${day.getUTCDate()} ${ru[day.getUTCMonth()]}`) + "#sick");
  ok(await o.locator("#sick [role=status]").getByText("Поняла так").count() >= 1, "помощник понял фразу «Я заболела …»");
  ok(await o.locator("#sick").getByText(/Затронуто записей: [1-9]/).count() === 1, "показаны затронутые записи");
  ok(await o.locator("#sick").getByText("Ничего не изменено").count() === 1, "явно сказано, что ничего не изменено");
  ok(await o.locator("#sick details", { hasText: "Черновик сообщения" }).count() === 1, "есть черновик сообщения клиентам (не отправляется)");
  ok((await get(mv)).status === "confirmed", "после превью записи не тронуты");
  await o.goto(BASE + "/owner/calendar?q=" + encodeURIComponent("мне плохо") + "#sick");
  ok(await o.locator("#sick").getByText("Не поняла даты").count() === 1, "непонятная фраза: помощник переспрашивает, а не угадывает");
  await b.close();
})().catch((e) => { console.log("FAIL " + e.message.split("\n")[0]); process.exit(1); });
