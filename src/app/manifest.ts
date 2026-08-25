import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rental Room 201 - Quản lý phòng trọ",
    short_name: "Rental Room",
    description:
      "Hệ thống quản lý phòng trọ dành cho Landlord và Staff.",
    lang: "vi",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#237b5c",
    theme_color: "#237b5c",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
