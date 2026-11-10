/** Подписи статусов записи для кабинета: [текст, css-вариант бейджа]. */
export const STATUS: Record<string, [string, string]> = {
  confirmed: ["подтверждена", "ok"], requested: ["ждёт подтверждения", "warn"], held: ["удержание", ""], completed: ["состоялась", "ok"], cancelled: ["отменена", "warn"], no_show: ["не пришёл", "warn"],
};
