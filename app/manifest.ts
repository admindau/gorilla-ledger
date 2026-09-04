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
    icons: [
      { src: "/logos/gorilla-ledger-logo-polished.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
