import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Homescreen-Icon (iOS rundet die Ecken selbst → Hintergrund randlos). */
export default async function AppleIcon() {
  const svg = (await readFile(join(process.cwd(), "src/app/icon.svg"), "utf8")).replace('rx="16" fill="url(#bg)"', 'fill="url(#bg)"');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    <img src={src} width={180} height={180} alt="" />,
    size,
  );
}
