import type { AbilityId } from '../../core/ids.ts';
import type { Roaster } from '../entities/entities.ts';
import type { SimContext } from './context.ts';

export interface AbilityStrategy {
  readonly id: AbilityId;
  readonly cooldown: number;
  /** Ready (cooldown, not stunned) AND situationally worthwhile. Must not allocate. */
  canUse(self: Roaster, ctx: SimContext): boolean;
  /** Executes the ability. Returns number of enemies/chickens affected (for the event log). */
  use(self: Roaster, ctx: SimContext): number;
}
