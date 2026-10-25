import type { Score } from '../../shared/types.ts';
import type { TiebreakStrategy } from '../strategies/tiebreak.ts';

const lastTick = (s: Score): number => (s.lastScoreTick < 0 ? Infinity : s.lastScoreTick);

/** GDD tiebreak: points, then chickens carried, then fastest time to score; remaining ties go to overtime. */
export const defaultTiebreak: TiebreakStrategy = {
  compare(a, b) {
    if (a.points !== b.points) return a.points - b.points;
    if (a.carried !== b.carried) return a.carried - b.carried;
    const ta = lastTick(a);
    const tb = lastTick(b);
    if (ta !== tb) return tb - ta; // earlier is better
    return 0;
  },
  resolve(a, b) {
    return this.compare(a, b) >= 0 ? a : b;
  },
};

/** Slots tied for first under the tiebreak (ascending slot order). */
export function leadingSlots(scores: readonly Score[], tb: TiebreakStrategy, out: number[]): number[] {
  out.length = 0;
  let best: Score | null = null;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    if (best === null || tb.compare(s, best) > 0) best = s;
  }
  if (best === null) return out;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]!;
    if (tb.compare(s, best) === 0) out.push(s.slot);
  }
  return out;
}
