import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/site";

/** /robots.txt: allow public pages, keep private and admin areas out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin/", "/dashboard", "/my-courses", "/profile", "/payment", "/account",
        "/parent-consent", "/auth/", "/reset-password", "/recommendation", "/test-survey",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
