import sharp from "sharp";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Generates a handful of flat-color placeholder "photos" with a label, used
 * only by the demo seed. These are obviously synthetic — the real labelled
 * photo dataset called for in the evaluation plan has to come from actual
 * Chennai reports collected with permission, which this repo cannot
 * fabricate. See README "Known limitations".
 */
const PLACEHOLDERS: { key: string; label: string; color: string }[] = [
  { key: "road", label: "Pothole / road damage (demo photo)", color: "#6b5b4a" },
  { key: "drain", label: "Drain / manhole (demo photo)", color: "#3a5a6b" },
  { key: "streetlight", label: "Streetlight (demo photo)", color: "#4a4a2a" },
  { key: "garbage", label: "Garbage (demo photo)", color: "#5a5a3a" },
  { key: "water", label: "Water supply/leak (demo photo)", color: "#2a5a7a" },
  { key: "power", label: "Power/wires (demo photo)", color: "#7a4a2a" },
  { key: "animal", label: "Stray animal (demo photo)", color: "#6a6a4a" },
  { key: "verification-after", label: "Closure verification (demo photo)", color: "#2a6a3a" },
];

export const SEED_MEDIA_DIR = join(process.cwd(), "public", "seed-media");

async function makePlaceholder(label: string, color: string): Promise<Buffer> {
  const width = 640;
  const height = 480;
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${color}" />
    <rect x="0" y="${height - 70}" width="100%" height="70" fill="rgba(0,0,0,0.45)" />
    <text x="20" y="${height - 28}" font-family="sans-serif" font-size="22" fill="white">${label}</text>
    <text x="20" y="40" font-family="sans-serif" font-size="16" fill="rgba(255,255,255,0.75)">Synthetic demo image — not a real photo</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

/** Returns { key -> public path } for the generated placeholders, generating files on first run. */
export async function ensureSeedMedia(): Promise<Record<string, string>> {
  if (!existsSync(SEED_MEDIA_DIR)) mkdirSync(SEED_MEDIA_DIR, { recursive: true });

  const paths: Record<string, string> = {};
  for (const p of PLACEHOLDERS) {
    const filename = `${p.key}.jpg`;
    const filePath = join(SEED_MEDIA_DIR, filename);
    if (!existsSync(filePath)) {
      const buf = await makePlaceholder(p.label, p.color);
      writeFileSync(filePath, buf);
    }
    paths[p.key] = `/seed-media/${filename}`;
  }
  return paths;
}
