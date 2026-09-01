import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gorilla Ledger™",
    short_name: "Gorilla Ledger",
    description: "A focused, multi-currency personal ledger.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#020202",
    theme_color: "#050505",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
