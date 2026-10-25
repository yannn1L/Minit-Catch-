import type { Score } from '../../shared/types.ts';

export interface TiebreakStrategy {
  /** Returns the winning Score; an exact tie returns `a` (callers detect ties via compare()). */
  resolve(a: Score, b: Score): Score;
  /** >0 if a beats b, <0 if b beats a, 0 for a full tie. */
  compare(a: Score, b: Score): number;
}
