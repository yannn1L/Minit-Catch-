import type { AbilityId, ArenaId, RoasterId, SoundId, SpriteId } from '../core/ids.ts';
import { Registry } from '../core/Registry.ts';
import type { AbilityStrategy } from '../domain/strategies/ability.ts';
import type { ArenaLayout } from '../domain/strategies/arena.ts';
import type { RoasterDef, SpriteDef, ZzfxParams } from '../shared/types.ts';
import { registerAbilities } from './abilities.ts';
import { registerArenas } from './arenas.ts';
import { registerRoasters } from './roasters.ts';
import { registerSounds } from './sounds.ts';
import { registerSprites } from './sprites/index.ts';

export interface Registries {
  readonly roasters: Registry<RoasterId, RoasterDef>;
  readonly abilities: Registry<AbilityId, AbilityStrategy>;
  readonly arenas: Registry<ArenaId, ArenaLayout>;
  readonly sprites: Registry<SpriteId, SpriteDef>;
  readonly sounds: Registry<SoundId, ZzfxParams>;
}

/** Registers every definition. Sprites/sounds are included so LoadingScene can validate everything up-front. */
export function createRegistries(): Registries {
  const regs: Registries = {
    roasters: new Registry('roasterRegistry'),
    abilities: new Registry('abilityRegistry'),
    arenas: new Registry('arenaRegistry'),
    sprites: new Registry('spriteRegistry'),
    sounds: new Registry('soundRegistry'),
  };
  registerAbilities(regs.abilities);
  registerRoasters(regs.roasters);
  registerArenas(regs.arenas);
  registerSprites(regs.sprites);
  registerSounds(regs.sounds);
  for (const r of regs.roasters.all()) {
    if (!regs.abilities.has(r.ability)) throw new Error(`roaster "${r.id}" references unknown ability "${r.ability}"`);
    if (!regs.sprites.has(r.sprite)) throw new Error(`roaster "${r.id}" references unknown sprite "${r.sprite}"`);
  }
  return regs;
}
