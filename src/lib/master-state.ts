import { auditStmt, nowIso, one, type Db } from "./db";

/** Состояние мастера. Клиентские вопросы в состояниях, кроме «available», копятся в очереди и не прерывают.
 *  «Срочно» от клиента (в том числе VIP) состояние не меняет: срочность подтверждает только мастер. */
export const MASTER_STATES = ["available", "in_procedure", "break", "off", "dnd"] as const;
export type MasterState = (typeof MASTER_STATES)[number];
export const STATE_LABEL: Record<MasterState, string> = {
  available: "На связи", in_procedure: "На процедуре", break: "Перерыв", off: "Не работаю", dnd: "Не беспокоить",
};
export const STATE_HELP: Record<MasterState, string> = {
  available: "Вопросы клиентов видны сразу.",
  in_procedure: "Вопросы копятся, вас не отвлекают. ИИ говорит клиентам, что вы ответите после процедуры.",
  break: "Удобно разобрать накопленные вопросы одной пачкой.",
  off: "Нерабочее время. Вопросы ждут до следующего рабочего дня.",
  dnd: "Полная тишина до тех пор, пока вы сами не снимете режим.",
};
/** Состояния, при которых клиенту нужно сказать «мастер ответит позже» */
export const isBusyState = (s: MasterState) => s !== "available" && s !== "break";

export async function getMasterState(db: Db, tenantId: string, nowMs = Date.now()): Promise<{ state: MasterState; untilAt: string | null }> {
  try {
    const r = await one<{ state: MasterState; until_at: string | null }>(db, "SELECT state,until_at FROM master_state WHERE tenant_id=?1", [tenantId]);
    if (!r) return { state: "available", untilAt: null };
    if (r.until_at && new Date(r.until_at).getTime() <= nowMs) return { state: "available", untilAt: null }; // срок вышел
    return { state: r.state, untilAt: r.until_at };
  } catch { return { state: "available", untilAt: null }; }
}

export async function setMasterState(db: Db, tenantId: string, state: string, untilAt: string | null, by = "owner"): Promise<boolean> {
  if (!(MASTER_STATES as readonly string[]).includes(state)) return false;
  await db.batch([
    { sql: `INSERT INTO master_state(tenant_id,state,until_at,updated_at,updated_by) VALUES (?1,?2,?3,?4,?5)
      ON CONFLICT(tenant_id) DO UPDATE SET state=?2,until_at=?3,updated_at=?4,updated_by=?5`, params: [tenantId, state, untilAt, nowIso(), by] },
    auditStmt(tenantId, by, "master_state.set", state, { untilAt }),
  ]);
  return true;
}

/** Занят ли мастер для клиента: включён старый переключатель «мастер занят» или состояние на процедуре / не беспокоить / не работаю */
export async function isMasterBusy(db: Db, tenantId: string, nowMs = Date.now()): Promise<boolean> {
  const { getPolicies } = await import("./policies");
  if ((await getPolicies(db, tenantId)).values.master_busy) return true;
  return isBusyState((await getMasterState(db, tenantId, nowMs)).state);
}
