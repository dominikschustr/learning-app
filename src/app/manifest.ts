import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Web-App-Manifest: nötig, damit die App vom Home-Bildschirm aus Mitteilungen (Web Push) bekommen kann. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lernwerk",
    short_name: "Lernwerk",
    description: "Prüfungsnah lernen: Karteikarten, Übungsfragen und Prüfungssimulationen.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#f7f5f0",
    icons: [
      { src: `${base}/apple-icon.png`, sizes: "180x180", type: "image/png" },
      { src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
