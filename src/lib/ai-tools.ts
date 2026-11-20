import { auditStmt, type Db } from "./db";

/** Реестр инструментов ИИ-администратора и матрица полномочий (ТЗ v2.0, раздел о границах ИИ).
 *  auto: ИИ делает сам; confirm: только после явного подтверждения клиента; master: решает мастер, у ИИ этого инструмента нет.
 *  ИИ не пишет в базу напрямую: любое действие идёт через серверную функцию из этого списка. */
export type ToolMode = "auto" | "confirm" | "master";
export const TOOLS = {
  getServices: { mode: "auto", writes: false, label: "Услуги и утверждённые цены" },
  getAvailability: { mode: "auto", writes: false, label: "Свободное время из календаря" },
  matchArticle: { mode: "auto", writes: false, label: "Статья библиотеки" },
  llm: { mode: "auto", writes: false, label: "Ответ по утверждённым знаниям" },
  requestHandoff: { mode: "auto", writes: true, label: "Передать вопрос мастеру" },
  recognizeClient: { mode: "auto", writes: true, label: "Узнать клиента по защищённой ссылке записи" },
  addAiNote: { mode: "auto", writes: true, label: "Заметка «от ИИ» в карточке клиента" },
  changeBooking: { mode: "confirm", writes: true, label: "Перенос или отмена записи по ссылке" },
  createBooking: { mode: "confirm", writes: true, label: "Создание записи" },
  addToWaitlist: { mode: "confirm", writes: true, label: "Лист ожидания (клиент сам оставил контакт)" },
  replyToClient: { mode: "master", writes: true, label: "Ответ мастера клиенту" },
  setDiscount: { mode: "master", writes: true, label: "Скидка, компенсация, бонус" },
  setVipStatus: { mode: "master", writes: true, label: "VIP-статус" },
  changePrice: { mode: "master", writes: true, label: "Изменение цены или правил" },
  medicalAdvice: { mode: "master", writes: true, label: "Медицинская оценка" },
} as const satisfies Record<string, { mode: ToolMode; writes: boolean; label: string }>;
export type ToolName = keyof typeof TOOLS;

/** Можно ли выполнить инструмент: auto всегда, confirm только с подтверждением клиента, master никогда от имени ИИ. */
export function toolAllowed(name: string, confirmedByClient = false): boolean {
  const t = (TOOLS as Record<string, { mode: ToolMode }>)[name];
  if (!t) return false;
  return t.mode === "auto" || (t.mode === "confirm" && confirmedByClient);
}
/** Журнал: каждое записывающее действие ИИ оставляет след в audit_events. */
export async function auditTool(db: Db, tenantId: string, name: ToolName, target?: string, detail?: unknown) {
  if (!TOOLS[name].writes) return;
  const a = auditStmt(tenantId, "ai", `ai.${name}`, target, detail); await db.run(a.sql, a.params);
}
