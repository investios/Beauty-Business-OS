import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return INDEXABLE
    ? { rules: [{ userAgent: "*", allow: "/", disallow: ["/owner", "/api", "/concepts", "/*/manage"] }], sitemap: `${SITE_URL}/sitemap.xml` }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
