import type { Loc } from "./i18n";

export type MsgKind = "booking_confirmation" | "reminder_24h" | "reminder_2d" | "reminder_morning" | "reminder_1h" | "followup" | "rebook";
export const KIND_LABEL: Record<MsgKind, string> = {
  booking_confirmation: "Подтверждение записи", reminder_24h: "Напоминание вечером накануне", reminder_2d: "Напоминание за 2 дня", reminder_morning: "Напоминание утром в день визита", reminder_1h: "Напоминание за час", followup: "Как прошёл визит", rebook: "Приглашение на повторный визит",
};
/** Служебные сообщения нужны для самой записи; рекламные требуют отдельного согласия на маркетинг */
export const IS_MARKETING: Record<MsgKind, boolean> = { booking_confirmation: false, reminder_24h: false, reminder_2d: false, reminder_morning: false, reminder_1h: false, followup: false, rebook: true };

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
  reminder_2d: {
    ru: { subject: "Через 2 дня ваша запись: {when}", body: "Здравствуйте, {name}!\n\nНапоминаем: «{service}», {when}. Подтвердить, перенести или отменить запись можно по ссылке: {manageUrl}\n\nДо встречи!\n{salon}" },
    en: { subject: "Your appointment in 2 days: {when}", body: "Hello {name},\n\nA reminder about “{service}”, {when}. You can confirm, reschedule or cancel here: {manageUrl}\n\nSee you soon,\n{salon}" },
    uk: { subject: "Через 2 дні ваш запис: {when}", body: "Вітаємо, {name}!\n\nНагадуємо: «{service}», {when}. Підтвердити, перенести або скасувати запис можна за посиланням: {manageUrl}\n\nДо зустрічі!\n{salon}" },
  },
  reminder_morning: {
    ru: { subject: "Сегодня ваша запись: {when}", body: "Доброе утро, {name}!\n\nСегодня вас ждут: «{service}», {when}. Если что-то изменилось, напишите заранее: {manageUrl}\n\n{salon}" },
    en: { subject: "Your appointment is today: {when}", body: "Good morning {name},\n\nWe look forward to seeing you today: “{service}”, {when}. If anything changes, please let us know: {manageUrl}\n\n{salon}" },
    uk: { subject: "Сьогодні ваш запис: {when}", body: "Доброго ранку, {name}!\n\nСьогодні на вас чекають: «{service}», {when}. Якщо щось змінилося, напишіть заздалегідь: {manageUrl}\n\n{salon}" },
  },
  reminder_1h: {
    ru: { subject: "Ждём вас через час: {when}", body: "Здравствуйте, {name}! Напоминаем: «{service}», {when}. Если опаздываете, сообщите по ссылке: {manageUrl}\n\n{salon}" },
    en: { subject: "See you in an hour: {when}", body: "Hello {name}, a reminder: “{service}”, {when}. If you are running late, let us know here: {manageUrl}\n\n{salon}" },
    uk: { subject: "Чекаємо на вас за годину: {when}", body: "Вітаємо, {name}! Нагадуємо: «{service}», {when}. Якщо запізнюєтесь, повідомте за посиланням: {manageUrl}\n\n{salon}" },
  },
  followup: {
    ru: { subject: "Как ваши ощущения после визита?", body: "Здравствуйте, {name}!\n\nСпасибо, что были у нас. Как вы себя чувствуете после визита? Ответьте на это письмо цифрой: 1 — всё отлично; 2 — есть вопрос по уходу; 3 — что-то беспокоит. На 2 и 3 мы ответим по существу и поможем разобраться.\n\n{salon}" },
    en: { subject: "How have things felt since your visit?", body: "Hello {name},\n\nThank you for visiting. How have things felt since your appointment? Just reply to this email with a number: 1 — all good; 2 — I have a care question; 3 — something is bothering me. We'll make sure you have the support you need.\n\n{salon}" },
    uk: { subject: "Як ваші відчуття після візиту?", body: "Вітаємо, {name}!\n\nДякуємо, що були у нас. Як ваші відчуття після візиту? Дайте відповідь на цей лист цифрою: 1 — усе добре; 2 — є запитання щодо догляду; 3 — щось турбує. Допоможемо розібратися.\n\n{salon}" },
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
