import type { MetadataRoute } from "next";
import { APP_NAME, APP_NAME_TA, APP_TAGLINE_EN } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} (${APP_NAME_TA})`,
    short_name: APP_NAME,
    description: APP_TAGLINE_EN,
    start_url: "/en",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#0f5132",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
