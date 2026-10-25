import type { ArenaLayoutResult } from '../strategies/arena.ts';

/** Max difference between coops' nearest-spawn distances (0 = perfectly fair). */
export function coopSpawnSpread(a: ArenaLayoutResult): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of a.coops) {
    let best = Infinity;
    for (const s of a.spawnPoints) best = Math.min(best, Math.hypot(s.x - c.x, s.y - c.y));
    lo = Math.min(lo, best);
    hi = Math.max(hi, best);
  }
  return hi - lo;
}

/** Fairness: validate coop->chicken spawn distance, and keep spawns/coops clear of pillars. */
export function validateArenaFairness(a: ArenaLayoutResult, tolerance = 1e-6): string[] {
  const errs: string[] = [];
  const spread = coopSpawnSpread(a);
  if (spread > tolerance) errs.push(`coop->spawn distance spread ${spread.toFixed(4)} exceeds ${tolerance}`);
  for (const o of a.obstacles) {
    for (const s of a.spawnPoints) if (Math.hypot(s.x - o.x, s.y - o.y) < o.r + 0.9) errs.push('spawn point overlaps an obstacle');
    for (const c of a.coops) if (Math.hypot(c.x - o.x, c.y - o.y) < o.r + 2.0) errs.push('coop overlaps an obstacle');
  }
  return errs;
}
