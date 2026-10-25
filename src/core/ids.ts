// Branded string IDs: compile-time only, zero runtime cost.
declare const brandSym: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brandSym]: B };

export type RoasterId = Brand<string, 'RoasterId'>;
export type AbilityId = Brand<string, 'AbilityId'>;
export type ArenaId = Brand<string, 'ArenaId'>;
export type SpriteId = Brand<string, 'SpriteId'>;
export type SoundId = Brand<string, 'SoundId'>;

export const roasterId = (s: string): RoasterId => s as RoasterId;
export const abilityId = (s: string): AbilityId => s as AbilityId;
export const arenaId = (s: string): ArenaId => s as ArenaId;
export const spriteId = (s: string): SpriteId => s as SpriteId;
export const soundId = (s: string): SoundId => s as SoundId;
