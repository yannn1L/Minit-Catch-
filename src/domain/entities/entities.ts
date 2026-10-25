import type { AbilityId, RoasterId } from '../../core/ids.ts';
import type { RoasterStats } from '../../shared/types.ts';

export type RoasterState = 'idle' | 'carry' | 'stun';
export type ChickenState = 'free' | 'carried' | 'stored';

export const TARGET_NONE = 0;
export const TARGET_CHICKEN = 1;
export const TARGET_LURE = 2;
export type TargetKind = 0 | 1 | 2;

/** Reused every think; no allocation. */
export interface AiIntent {
  hasTarget: boolean;
  tx: number;
  ty: number;
  targetKind: TargetKind;
  targetId: number;
  cast: boolean;
  wanderUntil: number;
  wx: number;
  wy: number;
}

export interface Roaster {
  readonly id: number; // == slot
  readonly slot: number;
  readonly roasterId: RoasterId;
  readonly abilityId: AbilityId;
  readonly stats: RoasterStats;
  readonly radius: number;
  x: number;
  y: number;
  px: number; // previous tick position (render interpolation)
  py: number;
  vx: number;
  vy: number;
  kx: number; // knockback velocity
  ky: number;
  dirX: number;
  dirY: number;
  state: RoasterState;
  stunUntil: number;
  rootUntil: number;
  shieldUntil: number;
  buffUntil: number;
  buffMult: number;
  dashLeft: number;
  dashDirX: number;
  dashDirY: number;
  dashSpeed: number;
  cooldownLeft: number;
  carried: number; // chicken id or -1
  channelKind: TargetKind;
  channelTarget: number;
  channelLeft: number;
  intent: AiIntent;
  catches: number;
  stuns: number;
  delivered: number;
}

export interface Chicken {
  readonly id: number;
  alive: boolean;
  state: ChickenState;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  wanderX: number;
  wanderY: number;
  wanderUntil: number;
  carrier: number; // roaster id or -1
  pullTo: number; // roaster id or -1
  pullUntil: number;
  grabUntil: number; // frozen while a roaster channels the pickup
}

export interface Coop {
  readonly id: number; // == slot
  readonly slot: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly radius: number;
  score: number;
  lockUntil: number;
  lastScoreTick: number; // -1 when none
}

export interface Lure {
  readonly id: number;
  alive: boolean;
  x: number;
  y: number;
  owner: number;
  expiresAt: number;
}

export interface Bomb {
  alive: boolean;
  x: number;
  y: number;
  owner: number;
  detonateAt: number;
  radius: number;
  stunSec: number;
}

export function createIntent(): AiIntent {
  return { hasTarget: false, tx: 0, ty: 0, targetKind: TARGET_NONE, targetId: -1, cast: false, wanderUntil: 0, wx: 0, wy: 0 };
}
