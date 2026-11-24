/**
 * Duplicate-report detection. Pure, DB-free scoring so it can be evaluated
 * against seeded precision/recall fixtures (tests/duplicate.test.ts) exactly
 * like the spec's "seeded cases" evaluation asks for.
 */

export interface DuplicateSignal {
  distanceM: number;
  sameCategory: boolean;
  textSimilarity: number; // 0..1, e.g. token Jaccard between descriptions
  imageSimilarity: number | null; // 0..1 from perceptual hash distance, or null if unavailable
}

export interface DuplicateScoreResult {
  score: number; // 0..1
  isDuplicateCandidate: boolean;
  basis: DuplicateSignal;
}

const DISTANCE_SCALE_M = 80; // distance beyond which spatial evidence contributes ~0
const DUPLICATE_THRESHOLD = 0.62;

function distanceScore(distanceM: number): number {
  return Math.max(0, 1 - distanceM / DISTANCE_SCALE_M);
}

export function scoreDuplicate(signal: DuplicateSignal): DuplicateScoreResult {
  if (!signal.sameCategory) {
    return { score: 0, isDuplicateCandidate: false, basis: signal };
  }

  const dScore = distanceScore(signal.distanceM);
  const tScore = signal.textSimilarity;
  const iScore = signal.imageSimilarity ?? 0;

  // Weighted blend: location is the strongest signal (misclassified category
  // text still usually happens at the same spot), image similarity next,
  // text weakest (short, template-ish descriptions all look alike).
  const weights = signal.imageSimilarity === null ? { d: 0.7, t: 0.3, i: 0 } : { d: 0.5, t: 0.2, i: 0.3 };
  const score = dScore * weights.d + tScore * weights.t + iScore * weights.i;

  return {
    score,
    isDuplicateCandidate: score >= DUPLICATE_THRESHOLD,
    basis: signal,
  };
}

/** Simple, dependency-free token-Jaccard similarity for Tamil/English short text. */
export function textJaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFC")
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 1)
    );
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const tok of setA) if (setB.has(tok)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Hamming distance between two equal-length hex perceptual hashes, normalized to 0..1 similarity. */
export function phashSimilarity(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return 0;
  let differing = 0;
  for (let i = 0; i < hashA.length; i++) {
    const bitsA = parseInt(hashA[i], 16);
    const bitsB = parseInt(hashB[i], 16);
    let x = bitsA ^ bitsB;
    while (x) {
      differing += x & 1;
      x >>= 1;
    }
  }
  const totalBits = hashA.length * 4;
  return 1 - differing / totalBits;
}
