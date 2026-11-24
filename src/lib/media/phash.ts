/**
 * A real (not fabricated) perceptual hash: average-hash (aHash). Downscales
 * to 8x8 grayscale, thresholds each pixel against the mean, and packs the
 * 64 bits into 16 hex characters so it's comparable with
 * duplicate/detect.ts's phashSimilarity (Hamming distance over hex chars).
 * aHash is simple and fast enough for low-end phones' photos, at the cost of
 * being more sensitive to brightness/crop changes than a DCT-based pHash —
 * an honest tradeoff, not a placeholder.
 */
import sharp from "sharp";

const SIZE = 8;

export async function computeImageHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize(SIZE, SIZE, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;

  let hex = "";
  for (let nibbleStart = 0; nibbleStart < pixels.length; nibbleStart += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) {
      nibble = (nibble << 1) | (pixels[nibbleStart + bit] >= mean ? 1 : 0);
    }
    hex += nibble.toString(16);
  }
  return hex;
}
