import { auditStmt, nowIso, one, rows, uuid, type Db } from "./db";
import { BookingError, cancelBooking, getAvailability, getBookingByToken, rescheduleBooking } from "./booking";
import { formatLocal } from "./tz";

/** Действия ИИ над записью клиента. Правила безопасности:
 *  1) запись находится только по секретной ссылке из подтверждения (id + token), по имени или телефону никогда;
 *  2) ИИ только ПРЕДЛАГАЕТ; выполняет действие нажатие клиентом «Подтверждаю», один раз, в течение 15 минут;
 *  3) при неверной ссылке ответ не говорит, существует ли запись; 4) токен стирается после выполнения. */
export const ACTION_TTL_MIN = 15;
type Loc = "en" | "ru" | "uk";
const REF_RE = /manage\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\?(?:[^\s]*?&)?token=([A-Za-z0-9_-]{10,128})/i;
export function parseManageRef(text: string): { id: string; token: string } | null {
  const m = text.match(REF_RE); return m ? { id: m[1].toLowerCase(), token: m[2] } : null;
}
export const CANCEL_RE = /(отмен|скасув|cancel)/i;
export const RESCHEDULE_RE = /(перенес|перенос|перезапис|перенести|reschedul|move (?:my|the)|change (?:my|the) (?:appointment|booking|time))/i;

export type PendingView = { id: string; kind: "cancel" | "reschedule"; summary: string; needsSlot: boolean };
export type ActionOutcome = { message: string; pending?: PendingView; slots?: { startUtc: string; label: string; serviceId: string; actionId: string }[]; handoff?: boolean };

const X = {
  notFound: { en: "I couldn't verify that booking from the link. Please use the full link from your confirmation, or I can pass your request to the specialist.", ru: "Не получилось проверить запись по этой ссылке. Воспользуйтесь полной ссылкой из подтверждения записи или я передам ваш запрос мастеру.", uk: "Не вдалося перевірити запис за цим посиланням. Скористайтеся повним посиланням із підтвердження запису або я передам ваш запит майстру." },
  noRef: { en: "To change or cancel a booking I need the secure link from your booking confirmation (it contains “/manage/”). Paste it here. If you don't have it, leave a phone number or email and I'll pass this to the specialist.", ru: "Чтобы перенести или отменить запись, мне нужна защищённая ссылка из подтверждения записи (в ней есть «/manage/»). Вставьте её сюда. Если ссылки нет, оставьте телефон или почту, и я передам запрос мастеру.", uk: "Щоб перенести або скасувати запис, мені потрібне захищене посилання з підтвердження запису (у ньому є «/manage/»). Вставте його сюди. Якщо посилання немає, залиште телефон або пошту, і я передам запит майстру." },
  inactive: { en: "This booking can no longer be changed here (it is cancelled, already past, or not yet confirmed). I can pass it to the specialist.", ru: "Эту запись нельзя изменить здесь (она отменена, уже прошла или ещё не подтверждена). Могу передать мастеру.", uk: "Цей запис не можна змінити тут (він скасований, уже минув або ще не підтверджений). Можу передати майстру." },
  found: { en: "I found your booking:", ru: "Нашёл вашу запись:", uk: "Знайшов ваш запис:" },
  askWhat: { en: "Would you like to reschedule or cancel it?", ru: "Что сделать: перенести или отменить?", uk: "Що зробити: перенести чи скасувати?" },
  confirmCancel: { en: "Please confirm: cancel this booking? Nothing changes until you press the button.", ru: "Подтвердите: отменить эту запись? Пока вы не нажмёте кнопку, ничего не изменится.", uk: "Підтвердьте: скасувати цей запис? Доки ви не натиснете кнопку, нічого не зміниться." },
  chooseSlot: { en: "Choose a new time. Nothing changes until you confirm.", ru: "Выберите новое время. Пока вы не подтвердите, ничего не изменится.", uk: "Оберіть новий час. Доки ви не підтвердите, нічого не зміниться." },
  noSlots: { en: "I can't see free times to move it to. I can pass this to the specialist.", ru: "Не вижу свободного времени для переноса. Могу передать мастеру.", uk: "Не бачу вільного часу для перенесення. Можу передати майстру." },
  confirmMove: { en: "Please confirm: move the booking to", ru: "Подтвердите: перенести запись на", uk: "Підтвердьте: перенести запис на" },
  doneCancel: { en: "Done: the booking is cancelled.", ru: "Готово: запись отменена.", uk: "Готово: запис скасовано." },
  doneMove: { en: "Done: the booking is moved to", ru: "Готово: запись перенесена на", uk: "Готово: запис перенесено на" },
  declined: { en: "Okay, nothing was changed.", ru: "Хорошо, ничего не менял.", uk: "Добре, нічого не змінював." },
  expired: { en: "This request has expired, so nothing was changed. Please ask again.", ru: "Время на подтверждение вышло, ничего не изменено. Попросите ещё раз.", uk: "Час на підтвердження минув, нічого не змінено. Попросіть ще раз." },
  taken: { en: "That time was just taken, nothing was changed. Please choose another.", ru: "Это время только что заняли, ничего не изменено. Выберите другое.", uk: "Цей час щойно зайняли, нічого не змінено. Оберіть інший." },
  failed: { en: "I couldn't complete that, nothing was changed. I can pass it to the specialist.", ru: "Не получилось выполнить, ничего не изменено. Могу передать мастеру.", uk: "Не вдалося виконати, нічого не змінено. Можу передати майстру." },
};
export const actionText = (k: keyof typeof X, l: Loc) => X[k][l];

type ActionRow = { id: string; tenant_id: string; conversation_id: string; kind: string; booking_id: string; secret: string; new_start_utc: string | null; status: string; expires_at: string };
const exp = (now: Date) => new Date(now.getTime() + ACTION_TTL_MIN * 60000).toISOString();
async function ready(db: Db) { try { await rows(db, "SELECT 1 FROM ai_pending_actions LIMIT 1"); return true; } catch { return false; } }
async function svcTitle(db: Db, serviceId: string, l: Loc) {
  const s = await one<{ title_i18n: Record<string, string> }>(db, "SELECT title_i18n FROM services WHERE id=?1", [serviceId]);
  return s?.title_i18n?.[l] ?? s?.title_i18n?.en ?? "";
}

/** Последнее незавершённое действие диалога (после того, как клиент уже прислал ссылку) */
async function openAction(db: Db, tenantId: string, convId: string, now: Date) {
  return one<ActionRow>(db, "SELECT * FROM ai_pending_actions WHERE conversation_id=?1 AND tenant_id=?2 AND status IN ('awaiting_choice','awaiting_slot','pending') AND expires_at > ?3 ORDER BY created_at DESC LIMIT 1", [convId, tenantId, now.toISOString()]);
}

async function offerSlots(db: Db, a: ActionRow, l: Loc, now: Date): Promise<ActionOutcome> {
  const b = await one<{ service_id: string; staff_id: string }>(db, "SELECT service_id,staff_id FROM appointments WHERE id=?1 AND tenant_id=?2", [a.booking_id, a.tenant_id]);
  const av = b ? await getAvailability(db, { tenantId: a.tenant_id, serviceId: b.service_id, staffId: b.staff_id, days: 30, now, excludeAppointmentId: a.booking_id }) : [];
  if (!av.length) return { message: actionText("noSlots", l), handoff: true };
  return { message: actionText("chooseSlot", l), slots: av.slice(0, 4).map((s) => ({ startUtc: s.startUtc, label: formatLocal(new Date(s.startUtc).getTime(), l), serviceId: b!.service_id, actionId: a.id })) };
}

/** Вход из сообщения клиента: есть ли ссылка и что он хочет */
export async function handleChangeRequest(db: Db, p: { tenantId: string; conversationId: string; text: string; locale: Loc; wants: "cancel" | "reschedule" | null; now?: Date }): Promise<ActionOutcome> {
  const now = p.now ?? new Date(), l = p.locale;
  if (!(await ready(db))) return { message: actionText("noRef", l), handoff: true };
  const ref = parseManageRef(p.text);
  let a: ActionRow | null = null;
  if (ref) {
    const b = await getBookingByToken(db, p.tenantId, ref.id, ref.token);
    if (!b) return { message: actionText("notFound", l), handoff: true };
    if (b.status !== "confirmed" || new Date(b.start_at) <= now) return { message: actionText("inactive", l), handoff: true };
    await db.run("UPDATE ai_pending_actions SET status='declined' WHERE conversation_id=?1 AND status IN ('awaiting_choice','awaiting_slot','pending')", [p.conversationId]);
    const id = uuid();
    await db.run("INSERT INTO ai_pending_actions(id,tenant_id,conversation_id,kind,booking_id,secret,status,expires_at,created_at) VALUES (?1,?2,?3,'lookup',?4,?5,'awaiting_choice',?6,?7)", [id, p.tenantId, p.conversationId, ref.id, ref.token, exp(now), now.toISOString()]);
    a = (await one<ActionRow>(db, "SELECT * FROM ai_pending_actions WHERE id=?1", [id]))!;
  } else a = await openAction(db, p.tenantId, p.conversationId, now);
  if (!a) return { message: actionText("noRef", l), handoff: true };
  const b = await getBookingByToken(db, p.tenantId, a.booking_id, a.secret);
  if (!b) return { message: actionText("notFound", l), handoff: true };
  const when = formatLocal(new Date(b.start_at).getTime(), l), svc = await svcTitle(db, b.service_id, l);
  const found = `${actionText("found", l)} ${svc}, ${when}.`;
  if (!p.wants) return { message: `${found} ${actionText("askWhat", l)}` };
  if (p.wants === "cancel") {
    await db.run("UPDATE ai_pending_actions SET kind='cancel', status='pending', expires_at=?2 WHERE id=?1", [a.id, exp(now)]);
    return { message: `${found} ${actionText("confirmCancel", l)}`, pending: { id: a.id, kind: "cancel", summary: `${svc}, ${when}`, needsSlot: false } };
  }
  await db.run("UPDATE ai_pending_actions SET kind='reschedule', status='awaiting_slot', new_start_utc=NULL, expires_at=?2 WHERE id=?1", [a.id, exp(now)]);
  const off = await offerSlots(db, { ...a, kind: "reschedule" }, l, now);
  return { ...off, message: `${found} ${off.message}` };
}

async function load(db: Db, tenantId: string, conversationId: string, actionId: string) {
  return one<ActionRow>(db, "SELECT * FROM ai_pending_actions WHERE id=?1 AND tenant_id=?2 AND conversation_id=?3", [actionId, tenantId, conversationId]);
}

/** Клиент выбрал новое время для переноса: время должно быть из настоящего календаря */
export async function chooseSlot(db: Db, p: { tenantId: string; conversationId: string; actionId: string; startUtc: string; locale: Loc; now?: Date }): Promise<ActionOutcome> {
  const now = p.now ?? new Date(), l = p.locale;
  const a = await load(db, p.tenantId, p.conversationId, p.actionId);
  if (!a || a.kind !== "reschedule" || !["awaiting_slot", "pending"].includes(a.status)) return { message: actionText("failed", l) };
  if (a.expires_at <= now.toISOString()) { await db.run("UPDATE ai_pending_actions SET status='expired' WHERE id=?1", [a.id]); return { message: actionText("expired", l) }; }
  const b = await getBookingByToken(db, p.tenantId, a.booking_id, a.secret);
  if (!b || b.status !== "confirmed") return { message: actionText("inactive", l) };
  const av = await getAvailability(db, { tenantId: p.tenantId, serviceId: b.service_id, days: 40, now, excludeAppointmentId: a.booking_id });
  const iso = new Date(p.startUtc).toISOString();
  if (!av.some((s) => s.startUtc === iso)) { const off = await offerSlots(db, a, l, now); return { ...off, message: `${actionText("taken", l)} ${off.message}` }; }
  await db.run("UPDATE ai_pending_actions SET new_start_utc=?2, status='pending', expires_at=?3 WHERE id=?1", [a.id, iso, exp(now)]);
  const when = formatLocal(new Date(iso).getTime(), l);
  return { message: `${actionText("confirmMove", l)} ${when}?`, pending: { id: a.id, kind: "reschedule", summary: when, needsSlot: false } };
}

/** Единственное место, где ИИ-диалог меняет запись: только по нажатию клиента, один раз */
export async function confirmAction(db: Db, p: { tenantId: string; conversationId: string; actionId: string; locale: Loc; now?: Date }): Promise<{ ok: boolean; message: string }> {
  const now = p.now ?? new Date(), l = p.locale;
  const a = await load(db, p.tenantId, p.conversationId, p.actionId);
  if (!a || a.status !== "pending") return { ok: false, message: actionText("failed", l) };
  if (a.expires_at <= now.toISOString()) { await db.run("UPDATE ai_pending_actions SET status='expired', secret='' WHERE id=?1 AND status='pending'", [a.id]); return { ok: false, message: actionText("expired", l) }; }
  // «забираем» действие атомарно: второе нажатие ничего не выполнит
  const claim = await db.run("UPDATE ai_pending_actions SET status='done', done_at=?2 WHERE id=?1 AND status='pending'", [a.id, now.toISOString()]);
  if (claim.changes !== 1) return { ok: false, message: actionText("failed", l) };
  try {
    let msg: string;
    if (a.kind === "cancel") { await cancelBooking(db, p.tenantId, a.booking_id, a.secret); msg = actionText("doneCancel", l); }
    else if (a.kind === "reschedule" && a.new_start_utc) {
      await rescheduleBooking(db, { tenantId: p.tenantId, id: a.booking_id, token: a.secret, newStartUtc: a.new_start_utc, now });
      msg = `${actionText("doneMove", l)} ${formatLocal(new Date(a.new_start_utc).getTime(), l)}.`;
    } else throw new BookingError("not_found", "bad action");
    await db.batch([
      { sql: "UPDATE ai_pending_actions SET secret='' WHERE id=?1", params: [a.id] },
      auditStmt(p.tenantId, "ai", `ai.${a.kind}.confirmed`, a.booking_id, { conversation: a.conversation_id, action: a.id }),
    ]);
    return { ok: true, message: msg };
  } catch (e) {
    const code = e instanceof BookingError ? e.code : "error";
    await db.run("UPDATE ai_pending_actions SET status='failed', error=?2, secret='' WHERE id=?1", [a.id, code]);
    return { ok: false, message: code === "slot_taken" || code === "slot_unavailable" ? actionText("taken", l) : actionText("failed", l) };
  }
}

export async function declineAction(db: Db, p: { tenantId: string; conversationId: string; actionId: string; locale: Loc }) {
  await db.run("UPDATE ai_pending_actions SET status='declined', secret='' WHERE id=?1 AND tenant_id=?2 AND conversation_id=?3 AND status IN ('awaiting_choice','awaiting_slot','pending')", [p.actionId, p.tenantId, p.conversationId]);
  return { ok: true, message: actionText("declined", p.locale) };
}
export { nowIso };
