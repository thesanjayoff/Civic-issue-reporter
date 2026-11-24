// Generates the PWA app icons from a simple inline SVG mark. Run with
// `npm run icons:generate`. Output is committed (these are real app assets,
// unlike the synthetic seed-media photos which are gitignored).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

function markSvg(size, padding) {
  const inner = size - padding * 2;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0f5132" />
    <circle cx="${size / 2}" cy="${size / 2}" r="${inner / 2}" fill="#16a34a" />
    <text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-weight="700"
      font-size="${inner * 0.34}" fill="white">OK</text>
  </svg>`;
}

async function writeIcon(filename, size, padding) {
  const buf = await sharp(Buffer.from(markSvg(size, padding))).png().toBuffer();
  writeFileSync(join(outDir, filename), buf);
  console.log("wrote", filename);
}

await writeIcon("icon-192.png", 192, 0);
await writeIcon("icon-512.png", 512, 0);
await writeIcon("icon-maskable-512.png", 512, 60); // safe-zone padding for maskable icons
