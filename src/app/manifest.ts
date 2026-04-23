import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מעקב ביקורי משגיחים",
    short_name: "ביקורי משגיחים",
    description: "מערכת מעקב ובקרה לביקורי משגיחים",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f0f4f8",
    theme_color: "#0f766e",
    lang: "he",
    dir: "rtl",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
