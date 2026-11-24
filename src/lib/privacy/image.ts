import sharp from "sharp";

export interface BlurBox {
  /** Normalized 0..1 coordinates relative to image width/height — stable across client-detected and manually-drawn boxes regardless of display scale. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Strips all metadata (EXIF/GPS/orientation-as-metadata — orientation pixels
 * are physically rotated instead) and bakes irreversible pixelation into the
 * given boxes. This always runs server-side before a photo is published, so
 * a client can never "skip" blurring by just drawing a CSS overlay — the
 * published derivative never contains the original pixels under a box.
 */
export async function processPhotoForPublication(input: Buffer, blurBoxes: BlurBox[]): Promise<Buffer> {
  // A fresh sharp() instance per pipeline stage — reusing one instance after
  // an awaited metadata()/toBuffer() call on it is unreliable across sharp
  // versions, so every stage below starts clean from `input`.
  const meta = await sharp(input).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (blurBoxes.length === 0 || width === 0 || height === 0) {
    // sharp strips all metadata by default unless withMetadata()/keepExif() is
    // called, so a plain re-encode here is what actually removes EXIF/GPS.
    return sharp(input).rotate().jpeg({ quality: 85 }).toBuffer();
  }

  const PIXELATION_FACTOR = 12;
  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const box of blurBoxes) {
    const left = Math.max(0, Math.round(box.x * width));
    const top = Math.max(0, Math.round(box.y * height));
    const w = Math.max(1, Math.min(width - left, Math.round(box.width * width)));
    const h = Math.max(1, Math.min(height - top, Math.round(box.height * height)));
    if (w <= 0 || h <= 0) continue;

    // Two separate sharp() pipelines on purpose: calling .resize() twice on
    // the *same* pipeline just overrides the target size (last call wins),
    // it does not chain a downscale-then-upscale — that needs a real
    // intermediate buffer between the two resize operations.
    const downscaled = await sharp(input)
      .rotate()
      .extract({ left, top, width: w, height: h })
      .resize({
        width: Math.max(1, Math.round(w / PIXELATION_FACTOR)),
        height: Math.max(1, Math.round(h / PIXELATION_FACTOR)),
        kernel: "nearest",
      })
      .toBuffer();
    const region = await sharp(downscaled).resize({ width: w, height: h, kernel: "nearest" }).toBuffer();

    composites.push({ input: region, left, top });
  }

  const blurred = await sharp(input).rotate().composite(composites).jpeg({ quality: 85 }).toBuffer();
  return blurred;
}

/** Strips EXIF/GPS metadata only, no blurring — used for photos with no detected faces/plates. */
export async function stripExif(input: Buffer): Promise<Buffer> {
  return sharp(input).rotate().jpeg({ quality: 90 }).toBuffer();
}
