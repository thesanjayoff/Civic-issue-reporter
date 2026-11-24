import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { stripExif, processPhotoForPublication } from "@/lib/privacy/image";

async function makeNoisyJpegWithExif(width = 120, height = 120): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: "TestCam" } } })
    .toBuffer();
}

describe("stripExif", () => {
  it("removes EXIF metadata from the output image", async () => {
    const withExif = await makeNoisyJpegWithExif();
    const beforeMeta = await sharp(withExif).metadata();
    expect(beforeMeta.exif).toBeDefined();

    const stripped = await stripExif(withExif);
    const afterMeta = await sharp(stripped).metadata();
    expect(afterMeta.exif).toBeUndefined();
  });
});

describe("processPhotoForPublication", () => {
  it("strips EXIF even when there are no blur boxes", async () => {
    const withExif = await makeNoisyJpegWithExif();
    const result = await processPhotoForPublication(withExif, []);
    const meta = await sharp(result).metadata();
    expect(meta.exif).toBeUndefined();
  });

  function meanAbsDeviationOfPatch(data: Buffer, info: { width: number; channels: number }, left: number, top: number, size: number): number {
    const idx = (x: number, y: number) => (y * info.width + x) * info.channels;
    const samples: number[] = [];
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) samples.push(data[idx(left + dx, top + dy)]);
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return samples.reduce((a, b) => a + Math.abs(b - mean), 0) / samples.length;
  }

  it("bakes in irreversible pixelation that sharply reduces local noise vs. the untouched original", async () => {
    const original = await makeNoisyJpegWithExif(200, 200);
    const result = await processPhotoForPublication(original, [{ x: 0.25, y: 0.25, width: 0.5, height: 0.5 }]);

    const { data: origData, info: origInfo } = await sharp(original).raw().toBuffer({ resolveWithObject: true });
    const { data: blurData, info: blurInfo } = await sharp(result).raw().toBuffer({ resolveWithObject: true });

    // Average local noise over several small patches inside the blurred
    // region (not just one, so a single block boundary can't skew the
    // result) and compare against the same patches in the original.
    const patchOrigins = [
      [55, 55],
      [70, 70],
      [90, 60],
      [60, 90],
    ] as const;
    const origDeviation =
      patchOrigins.reduce((a, [x, y]) => a + meanAbsDeviationOfPatch(origData, origInfo, x, y, 4), 0) / patchOrigins.length;
    const blurDeviation =
      patchOrigins.reduce((a, [x, y]) => a + meanAbsDeviationOfPatch(blurData, blurInfo, x, y, 4), 0) / patchOrigins.length;

    expect(origDeviation).toBeGreaterThan(20); // sanity check: control really is noisy
    expect(blurDeviation).toBeLessThan(origDeviation / 2); // pixelation measurably smooths it
  });

  it("leaves pixels outside the blur box as photographic (non-flattened) content", async () => {
    const original = await makeNoisyJpegWithExif(200, 200);
    const result = await processPhotoForPublication(original, [{ x: 0.0, y: 0.0, width: 0.3, height: 0.3 }]);
    const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true });

    const idx = (x: number, y: number) => (y * info.width + x) * info.channels;
    const samples = [180, 185, 190, 195].map((x) => data[idx(x, 180)]);
    const allSame = samples.every((v) => v === samples[0]);
    expect(allSame).toBe(false);
  });
});
