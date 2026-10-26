import type { Rng } from '../../core/rng.ts';
import type { DropReason, SimEvent } from '../../shared/types.ts';
import type { Bomb, Chicken, Coop, Lure, Roaster } from '../entities/entities.ts';
import type { AbilityStrategy } from './ability.ts';
import type { ArenaLayoutResult } from './arena.ts';

/** What strategies may see/do. Implemented by sim/Simulation; keeps domain free of sim imports. */
export interface SimContext {
  readonly tick: number;
  readonly time: number;
  readonly arena: ArenaLayoutResult;
  readonly roasters: readonly Roaster[];
  readonly chickens: readonly Chicken[];
  readonly coops: readonly Coop[];
  readonly lures: readonly Lure[];
  readonly bombs: readonly Bomb[];
  readonly rngAi: Rng;
  readonly rngAbility: Rng;
  readonly isTagTeam?: boolean;
  teamOf?(slot: number): number;

  abilityOf(r: Roaster): AbilityStrategy;
  isShielded(r: Roaster): boolean;
  /** Free (uncarried, unstored) chickens within radius. Writes ids to out, returns count. */
  queryFreeChickens(x: number, y: number, radius: number, out: Int32Array): number;

  stun(target: Roaster, seconds: number, by: number): boolean;
  root(target: Roaster, seconds: number, by: number): boolean;
  knockback(target: Roaster, ix: number, iy: number, by: number): boolean;
  dropCarried(r: Roaster, reason: DropReason): void;
  grantShield(r: Roaster, seconds: number): void;
  lockCoop(coopId: number, seconds: number, by: number): void;
  plantBomb(x: number, y: number, fuse: number, radius: number, stunSec: number, owner: number): void;
  spawnLure(x: number, y: number, seconds: number, owner: number): void;
  emit(ev: SimEvent): void;
}
