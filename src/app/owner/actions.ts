"use server";
import { revalidatePath } from "next/cache";
import { ownerTenant } from "@/lib/auth";
import { audit, getDb, one } from "@/lib/db";
import { publishKnowledge } from "@/lib/seed";

async function guard() {
  const t = await ownerTenant();
  if (!t) throw new Error("unauthorized");
  return { tenantId: t.id, db: await getDb() };
}

export async function toggleAutomation(fd: FormData) {
  const { tenantId, db } = await guard();
  const key = String(fd.get("key"));
  const r = await one<{ enabled: boolean }>(db, "UPDATE automations SET enabled = NOT enabled WHERE tenant_id=$1 AND key=$2 RETURNING enabled", [tenantId, key]);
  await audit(db, tenantId, "owner", "automation.toggle", key, r);
  revalidatePath("/owner/marketing");
}
export async function resolveHandoff(fd: FormData) {
  const { tenantId, db } = await guard();
  await db.query("UPDATE handoffs SET status='resolved' WHERE id=$1 AND tenant_id=$2", [String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "handoff.resolve", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function saveDraft(fd: FormData) {
  const { tenantId, db } = await guard();
  const text = String(fd.get("text") ?? "").trim().slice(0, 2000);
  if (!text) return;
  await db.query("UPDATE knowledge_articles SET draft_answer=$1, updated_at=now() WHERE id=$2 AND tenant_id=$3", [text, String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "kb.draft", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function approveDraft(fd: FormData) {
  const { tenantId, db } = await guard();
  await db.query("UPDATE knowledge_articles SET answer=draft_answer, draft_answer=NULL, status='approved', approved_by='owner', updated_at=now() WHERE id=$1 AND tenant_id=$2 AND draft_answer IS NOT NULL", [String(fd.get("id")), tenantId]);
  await audit(db, tenantId, "owner", "kb.approve", String(fd.get("id")));
  revalidatePath("/owner/ai");
}
export async function publishVersion() {
  const { tenantId, db } = await guard();
  const v = await publishKnowledge(db, tenantId, "owner");
  await audit(db, tenantId, "owner", "kb.publish", String(v));
  revalidatePath("/owner/ai");
}
export async function activateVersion(fd: FormData) {
  const { tenantId, db } = await guard();
  const v = Number(fd.get("version"));
  await db.query("UPDATE knowledge_versions SET active=(version=$2) WHERE tenant_id=$1", [tenantId, v]);
  await audit(db, tenantId, "owner", "kb.rollback", String(v));
  revalidatePath("/owner/ai");
}
