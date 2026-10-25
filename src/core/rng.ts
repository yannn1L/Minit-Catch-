export type Rng = () => number;

/** mulberry32: tiny, fast, deterministic 32-bit PRNG returning [0,1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives an independent non-zero 32-bit seed per stream. */
export function deriveSeed(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h === 0 ? 1 : h;
}

export interface RngStreams {
  readonly spawn: Rng;
  readonly ai: Rng;
  readonly ability: Rng;
}

export function createStreams(seed: number): RngStreams {
  return {
    spawn: mulberry32(deriveSeed(seed, 1)),
    ai: mulberry32(deriveSeed(seed, 2)),
    ability: mulberry32(deriveSeed(seed, 3)),
  };
}
