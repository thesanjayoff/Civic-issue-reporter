import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { computeImageHash } from "@/lib/media/phash";
import { phashSimilarity } from "@/lib/duplicate/detect";

async function splitImage(leftGray: number, rightGray: number, size = 64): Promise<Buffer> {
  const left = sharp({ create: { width: size / 2, height: size, channels: 3, background: { r: leftGray, g: leftGray, b: leftGray } } }).png().toBuffer();
  const right = sharp({ create: { width: size / 2, height: size, channels: 3, background: { r: rightGray, g: rightGray, b: rightGray } } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([
      { input: await left, left: 0, top: 0 },
      { input: await right, left: size / 2, top: 0 },
    ])
    .jpeg()
    .toBuffer();
}

describe("computeImageHash (average hash)", () => {
  it("produces a 16-character hex hash", async () => {
    const hash = await computeImageHash(await splitImage(220, 30));
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives near-identical hashes for near-identical images", async () => {
    const a = await computeImageHash(await splitImage(220, 30));
    const b = await computeImageHash(await splitImage(215, 35));
    expect(phashSimilarity(a, b)).toBeGreaterThan(0.9);
  });

  it("gives a clearly lower similarity for a very different (inverted) image", async () => {
    const original = await computeImageHash(await splitImage(220, 30));
    const inverted = await computeImageHash(await splitImage(30, 220));
    expect(phashSimilarity(original, inverted)).toBeLessThan(0.3);
  });
});
