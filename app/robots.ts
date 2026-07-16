import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/contact", "/privacy", "/terms", "/security"],
      disallow: ["/dashboard", "/wallets", "/categories", "/transactions", "/budgets", "/recurring", "/exports", "/settings", "/mfa", "/auth"],
    },
    sitemap: "https://gl.savvyrilla.tech/sitemap.xml",
  };
}
