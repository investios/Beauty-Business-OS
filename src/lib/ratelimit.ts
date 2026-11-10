const hits = new Map<string, number[]>();
/** Простое ограничение частоты в памяти процесса (для пилота; в production — общий Redis). */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
/**
 * Адрес клиента для лимитов. В Cloudflare его ставит сам Cloudflare (заголовок cf-connecting-ip), клиент подделать его не может.
 * x-forwarded-for подделывается любым запросом, поэтому в production ему не доверяем: без cf-connecting-ip все такие запросы
 * попадают в один общий («строгий») лимит.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  if (process.env.NODE_ENV === "production") return "unknown";
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
