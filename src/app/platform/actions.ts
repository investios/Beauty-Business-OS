"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { platformAuthorized } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { EVAL_BATCH, EVAL_CASES, runEvalBatch } from "@/lib/consultant-eval";
import { listTenants, logAccess } from "@/lib/platform";

/** Прогон части вопросов на настоящей модели: только для владельца платформы. */
export async function runConsultantEval(fd: FormData) {
  if (!(await platformAuthorized())) throw new Error("unauthorized");
  const db = await getDb();
  const t = (await listTenants(db)).find((x) => x.id === String(fd.get("t") ?? ""));
  if (!t) throw new Error("tenant");
  const batch = Math.max(0, Math.min(Math.ceil(EVAL_CASES.length / EVAL_BATCH) - 1, Number(fd.get("batch")) || 0));
  await logAccess(db, t.id, "platform.eval", `batch${batch + 1}`);
  await runEvalBatch(db, t.id, batch);
  revalidatePath("/platform");
  redirect(`/platform?t=${t.id}&tab=eval&days=${Math.min(365, Number(fd.get("days")) || 90)}&m=ran${batch + 1}`);
}
