import type { NextConfig } from "next";
// Защитная политика: свои скрипты, стили, картинки и шрифты; никаких чужих адресов, встраивания в чужие страницы и «подмены» ссылок.
// 'unsafe-inline' нужен только для встроенных скриптов самого Next.js (без него страницы не запустятся); чужой код всё равно не пройдёт.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // «/» → язык по Accept-Language (UA, RU, иначе EN). Работает и на Cloudflare без отдельного middleware
  async redirects() {
    const r = (lang: string) => ({ source: "/", has: [{ type: "header" as const, key: "accept-language", value: `^${lang}.*` }], destination: `/${lang === "uk" ? "uk" : "ru"}`, permanent: false });
    return [r("uk"), r("ru"), { source: "/", destination: "/en", permanent: false }];
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
