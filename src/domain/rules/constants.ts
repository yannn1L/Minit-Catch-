// Gameplay constants (meters / seconds). Pure numbers, no behavior.
export const TICK_RATE = 30;
export const TICK = 1 / TICK_RATE;
export const DEFAULT_DURATION_SEC = 20;
export const OVERTIME_SEC = 5;

export const ROASTER_RADIUS = 0.45;
export const CHICKEN_RADIUS = 0.25;
export const COOP_RADIUS = 1.8;
export const COOP_RADIAL = 0.85; // coop distance as a fraction of arena radius

export const PICKUP_CHANNEL_SEC = 0.25; // GDD: 0.2-0.3, fixed midpoint keeps balance deterministic
export const MAX_STUN_SEC = 1.2;
export const CARRY_SPEED_MULT = 0.85;
export const CHANNEL_SPEED_MULT = 0.2;
export const MAX_PARTICIPANTS = 20;
export const MIN_PARTICIPANTS = 2;

export type MatchMode = 'ffa' | 'tag_team';
export const TAG_TEAM_SIZES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function teamOfSlot(slot: number, participants: number): 0 | 1 {
  return slot < Math.floor(participants / 2) ? 0 : 1;
}

export const AI_PERIOD_TICKS = 3; // AI thinks at 10 Hz, staggered by roaster id
export const ENEMY_AREA_RADIUS = 4.0; // chickens this close to an enemy coop are "camped"

export const MAX_LURES = 16;
export const MAX_BOMBS = 16;

export const CHICKEN_WANDER_SPEED = 0.9;
export const CHICKEN_FLEE_SPEED = 2.6;
export const CHICKEN_FLEE_RADIUS = 2.2;
export const CHICKEN_PULL_SPEED = 7;

export const OVERTIME_EXTRA_CHICKENS = 0;

/** Arena radius scales with participant count. */
export const arenaRadius = (participants: number): number => 6 + 0.9 * participants;

export function defaultChickenSpawn(participants: number): { initial: number; cap: number; interval: number } {
  return {
    initial: Math.round(participants * 2.5),
    cap: participants * 5,
    interval: Math.round((6 / participants) * 100) / 100,
  };
}
