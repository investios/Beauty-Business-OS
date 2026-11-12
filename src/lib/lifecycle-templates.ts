import type { Loc } from "./i18n";

export type MsgKind = "booking_confirmation" | "reminder_24h" | "followup" | "rebook";
export const KIND_LABEL: Record<MsgKind, string> = {
  booking_confirmation: "Подтверждение записи", reminder_24h: "Напоминание за сутки", followup: "Как прошёл визит", rebook: "Приглашение на повторный визит",
};
/** Служебные сообщения нужны для самой записи; рекламные требуют отдельного согласия на маркетинг */
export const IS_MARKETING: Record<MsgKind, boolean> = { booking_confirmation: false, reminder_24h: false, followup: false, rebook: true };

export type Vars = { name: string; salon: string; service: string; when: string; manageUrl: string };
type T = { subject: string; body: string };
// ВАЖНО: тексты черновые, ждут утверждения Милы. Без цен, обещаний результата и медицинских утверждений.
const T_: Record<MsgKind, Record<Loc, T>> = {
  booking_confirmation: {
    ru: { subject: "Запись подтверждена: {when}", body: "Здравствуйте, {name}!\n\nВаша запись «{service}» ждёт вас: {when}.\n\nПеренести или отменить запись можно по ссылке: {manageUrl}\n\nДо встречи!\n{salon}" },
    en: { subject: "Your booking is confirmed: {when}", body: "Hello {name},\n\nYour appointment for “{service}” is booked for {when}.\n\nTo reschedule or cancel, use this link: {manageUrl}\n\nSee you soon,\n{salon}" },
    uk: { subject: "Запис підтверджено: {when}", body: "Вітаємо, {name}!\n\nВаш запис «{service}» чекає на вас: {when}.\n\nПеренести або скасувати запис можна за посиланням: {manageUrl}\n\nДо зустрічі!\n{salon}" },
  },
  reminder_24h: {
    ru: { subject: "Напоминаем о записи завтра: {when}", body: "Здравствуйте, {name}!\n\nНапоминаем: «{service}», {when}.\n\nЕсли планы изменились, перенесите или отмените запись заранее: {manageUrl}\n\nДо встречи!\n{salon}" },
    en: { subject: "Reminder: your appointment is tomorrow, {when}", body: "Hello {name},\n\nA reminder about “{service}”, {when}.\n\nIf your plans change, please reschedule or cancel in advance: {manageUrl}\n\nSee you soon,\n{salon}" },
    uk: { subject: "Нагадуємо про запис завтра: {when}", body: "Вітаємо, {name}!\n\nНагадуємо: «{service}», {when}.\n\nЯкщо плани змінилися, перенесіть або скасуйте запис заздалегідь: {manageUrl}\n\nДо зустрічі!\n{salon}" },
  },
  followup: {
    ru: { subject: "Как всё прошло?", body: "Здравствуйте, {name}!\n\nСпасибо, что были у нас. Если есть вопросы после визита, просто ответьте на это письмо, мастер посмотрит.\n\n{salon}" },
    en: { subject: "How did it go?", body: "Hello {name},\n\nThank you for visiting. If you have any questions after your appointment, just reply to this email and the specialist will take a look.\n\n{salon}" },
    uk: { subject: "Як усе пройшло?", body: "Вітаємо, {name}!\n\nДякуємо, що були у нас. Якщо виникли запитання після візиту, просто дайте відповідь на цей лист, майстер подивиться.\n\n{salon}" },
  },
  rebook: {
    ru: { subject: "Когда удобно прийти снова?", body: "Здравствуйте, {name}!\n\nПрошло несколько недель с вашего визита. Если захотите записаться снова, выберите удобное время на сайте.\n\nНе хотите получать такие письма? Ответьте «стоп», и мы перестанем их присылать.\n\n{salon}" },
    en: { subject: "When would you like to come again?", body: "Hello {name},\n\nIt has been a few weeks since your visit. If you would like to book again, choose a convenient time on our website.\n\nDon't want these emails? Reply “stop” and we will stop sending them.\n\n{salon}" },
    uk: { subject: "Коли зручно прийти знову?", body: "Вітаємо, {name}!\n\nМинуло кілька тижнів від вашого візиту. Якщо захочете записатися знову, оберіть зручний час на сайті.\n\nНе хочете отримувати такі листи? Дайте відповідь «стоп», і ми перестанемо їх надсилати.\n\n{salon}" },
  },
};
export const PREVIEW_LINK = "[ссылка для управления записью]";
export function render(kind: MsgKind, loc: string, v: Vars): T {
  const l: Loc = loc === "ru" || loc === "uk" ? loc : "en";
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => (v as Record<string, string>)[k] ?? "");
  const t = T_[kind][l];
  return { subject: fill(t.subject), body: fill(t.body) };
}
