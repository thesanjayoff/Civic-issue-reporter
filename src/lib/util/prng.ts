/** Deterministic PRNG (mulberry32) so `npm run db:seed` produces the same demo data every time. */
export function mulberry32(seed: number) {
  let a = seed;
  return function random(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function randFloat(min: number, max: number, rng: Rng): number {
  return min + rng() * (max - min);
}

export function weightedPick<T>(items: readonly [T, number][], rng: Rng): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [item, w] of items) {
    if (r < w) return item;
    r -= w;
  }
  return items[items.length - 1][0];
}
