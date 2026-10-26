import type { AbilityId, ArenaId, RoasterId, SoundId, SpriteId } from '../core/ids.ts';
import { Registry } from '../core/Registry.ts';
import type { AbilityStrategy } from '../domain/strategies/ability.ts';
import type { AiStrategy } from '../domain/strategies/ai.ts';
import { ROLE_ARCHETYPES, type AiProfile } from '../domain/strategies/archetypes.ts';
import type { ArenaLayout } from '../domain/strategies/arena.ts';
import { createHybridAi, hybridAi } from '../domain/strategies/hybridAi.ts';
import type { RoasterDef, SpriteDef, ZzfxParams } from '../shared/types.ts';
import { getAbilityDef, registerAbilities } from './abilities.ts';
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
  readonly ai: Registry<string, AiStrategy>;
  readonly archetypes: Registry<string, AiProfile>;
}

/**
 * Resolves the appropriate Hybrid AI strategy for a given roaster definition
 * based on its associated ability role archetype.
 */
export function getAiForRoaster(regs: Registries, roaster: RoasterDef): AiStrategy {
  const abDef = getAbilityDef(roaster.ability);
  const role = abDef?.role ?? 'Default';
  return regs.ai.tryGet(role) ?? regs.ai.tryGet('Default') ?? hybridAi;
}

/** Registers every definition. Sprites/sounds are included so LoadingScene can validate everything up-front. */
export function createRegistries(): Registries {
  const regs: Registries = {
    roasters: new Registry('roasterRegistry'),
    abilities: new Registry('abilityRegistry'),
    arenas: new Registry('arenaRegistry'),
    sprites: new Registry('spriteRegistry'),
    sounds: new Registry('soundRegistry'),
    ai: new Registry('aiRegistry'),
    archetypes: new Registry('archetypeRegistry'),
  };

  // 1. Register Role Archetypes & AI Strategies
  for (const [name, profile] of Object.entries(ROLE_ARCHETYPES)) {
    regs.archetypes.register(name, profile);
    regs.ai.register(name, createHybridAi(profile));
  }

  // 2. Register Game Content Definitions
  registerAbilities(regs.abilities);
  registerRoasters(regs.roasters);
  registerArenas(regs.arenas);
  registerSprites(regs.sprites);
  registerSounds(regs.sounds);

  // 3. Strict Dependency Integrity & Invariant Validation
  for (const r of regs.roasters.all()) {
    if (!regs.abilities.has(r.ability)) {
      throw new Error(`[Registry Integrity] Roaster "${r.id}" references unknown ability "${r.ability}"`);
    }
    if (!regs.sprites.has(r.sprite)) {
      throw new Error(`[Registry Integrity] Roaster "${r.id}" references unknown sprite "${r.sprite}"`);
    }
    const st = r.stats;
    if (st.carrySlots !== 1) {
      throw new Error(`[Registry Invariant] Roaster "${r.id}" carrySlots must be 1 (got ${st.carrySlots})`);
    }
    if (st.moveSpeed < 4.0 || st.moveSpeed > 5.0) {
      throw new Error(`[Registry Invariant] Roaster "${r.id}" moveSpeed must be in 4.0..5.0 m/s range (got ${st.moveSpeed})`);
    }
    if (st.pickupRadius <= 0) {
      throw new Error(`[Registry Invariant] Roaster "${r.id}" pickupRadius must be > 0 (got ${st.pickupRadius})`);
    }
  }

  // 4. Seal all registries to enforce immutability at runtime
  regs.roasters.seal();
  regs.abilities.seal();
  regs.arenas.seal();
  regs.sprites.seal();
  regs.sounds.seal();
  regs.ai.seal();
  regs.archetypes.seal();

  return regs;
}
