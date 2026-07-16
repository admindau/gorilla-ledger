import type { MetadataRoute } from "next";
import { PRODUCT_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/contact", "/privacy", "/terms", "/security"],
      disallow: ["/dashboard", "/wallets", "/categories", "/transactions", "/budgets", "/recurring", "/exports", "/settings", "/mfa", "/auth"],
    },
    sitemap: `${PRODUCT_URL}/sitemap.xml`,
  };
}
