// Seeded PRNG (mulberry32). Whole RNG state lives in `state.s` so it
// serializes cleanly into save files — load a save, get the same enemy
// waves and event rolls.

export interface RNG {
  s: number;
}

export function createRng(seed: number): RNG {
  return { s: seed >>> 0 };
}

export function nextFloat(rng: RNG): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: RNG, maxExclusive: number): number {
  return Math.floor(nextFloat(rng) * maxExclusive);
}

export function nextRange(rng: RNG, min: number, maxExclusive: number): number {
  return min + Math.floor(nextFloat(rng) * (maxExclusive - min));
}

export function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[nextInt(rng, arr.length)]!;
}
