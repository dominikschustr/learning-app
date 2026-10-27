import type { NextConfig } from "next";

/**
 * Statische Seite für GitHub Pages: `npm run build` legt alles in out/ ab.
 * NEXT_PUBLIC_BASE_PATH ist der Unterordner, unter dem die Seite liegt (bei GitHub Pages /<repo>),
 * lokal leer. Der Deploy-Workflow (.github/workflows/deploy.yml) setzt ihn automatisch.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
