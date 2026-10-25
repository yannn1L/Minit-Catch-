import type { ArenaId } from '../../core/ids.ts';
import type { Rng } from '../../core/rng.ts';
import type { Vec2 } from '../../shared/types.ts';

export interface CoopSlot {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

export interface Obstacle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface ArenaLayoutResult {
  readonly radius: number;
  readonly coops: readonly CoopSlot[];
  readonly roasterSpawns: readonly Vec2[];
  readonly spawnPoints: readonly Vec2[];
  readonly obstacles: readonly Obstacle[];
}

export interface ArenaLayout {
  readonly id: ArenaId;
  readonly name: string;
  supports(participants: number): boolean;
  build(participants: number, rng: Rng): ArenaLayoutResult;
}
