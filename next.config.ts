import type { NextConfig } from "next";
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
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
