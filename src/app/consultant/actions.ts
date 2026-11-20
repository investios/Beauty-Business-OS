"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { consultantTenant } from "@/lib/auth";
import { audit, getDb } from "@/lib/db";
import { addConsultantNote } from "@/lib/consulting";

export async function saveConsultantNote(fd: FormData) {
  const t = await consultantTenant();
  if (!t) throw new Error("unauthorized");
  const db = await getDb();
  const ok = await addConsultantNote(db, t.id, String(fd.get("body") ?? ""));
  if (ok) await audit(db, t.id, "consultant", "consultant.note");
  revalidatePath("/consultant");
  redirect(`/consultant?m=${ok ? "saved" : "bad"}`);
}
