import type { MetadataRoute } from "next";
import { PRODUCT_URL } from "@/lib/brand";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/about", "/contact", "/privacy", "/terms", "/security"];

  return routes.map((route) => ({
    url: `${PRODUCT_URL}${route}`,
    lastModified: new Date("2026-07-16T00:00:00.000Z"),
    changeFrequency: route === "" ? "monthly" : "yearly",
    priority: route === "" ? 1 : 0.5,
  }));
}
