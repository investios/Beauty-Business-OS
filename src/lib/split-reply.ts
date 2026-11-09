/** Делит ответ на короткие реплики: по абзацам, затем по предложениям (до ~2 предложений или ~130 знаков) */
export function splitReply(text: string): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    const sentences = para.split(/(?<=[.!?…])\s+(?=[A-ZА-ЯІЇЄҐ0-9«"(])/);
    let cur = "";
    for (const sn of sentences) {
      if (cur && (cur.length + sn.length > 130)) { out.push(cur); cur = sn; } else cur = cur ? `${cur} ${sn}` : sn;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out.slice(0, 8).concat(out.length > 8 ? [out.slice(8).join(" ")] : []) : [text];
}

