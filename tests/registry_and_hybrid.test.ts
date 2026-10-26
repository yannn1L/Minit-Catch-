import { describe, expect, it } from 'vitest';
import { abilityId, roasterId, spriteId } from '../src/core/ids.ts';
import { Registry } from '../src/core/Registry.ts';
import { createRegistries, getAiForRoaster } from '../src/data/registries.ts';
import { getAiProfile, ROLE_ARCHETYPES } from '../src/domain/strategies/archetypes.ts';
import { createHybridAi, getStrategyForRole } from '../src/domain/strategies/hybridAi.ts';
import { Simulation } from '../src/sim/Simulation.ts';
import { defaultMatchConfig } from '../src/domain/rules/defaults.ts';

describe('Registry Pattern & Immutability', () => {
  it('blocks registration when sealed', () => {
    const reg = new Registry<string, number>('testRegistry');
    reg.register('item1', 100);
    expect(reg.isSealed).toBe(false);
    expect(reg.get('item1')).toBe(100);
    expect(reg.size).toBe(1);

    reg.seal();
    expect(reg.isSealed).toBe(true);
    expect(() => reg.register('item2', 200)).toThrow(/is sealed and immutable/);
    expect(reg.get('item1')).toBe(100);
  });

  it('provides safe tryGet and entries lookup', () => {
    const reg = new Registry<string, string>('testRegistry');
    reg.register('a', 'alpha');
    reg.register('b', 'beta');

    expect(reg.tryGet('a')).toBe('alpha');
    expect(reg.tryGet('c')).toBeUndefined();
    expect(reg.entries()).toEqual([['a', 'alpha'], ['b', 'beta']]);
  });

  it('createRegistries seals all registries after validation', () => {
    const regs = createRegistries();
    expect(regs.roasters.isSealed).toBe(true);
    expect(regs.abilities.isSealed).toBe(true);
    expect(regs.arenas.isSealed).toBe(true);
    expect(regs.sprites.isSealed).toBe(true);
    expect(regs.sounds.isSealed).toBe(true);
    expect(regs.ai.isSealed).toBe(true);
    expect(regs.archetypes.isSealed).toBe(true);
  });

  it('rejects registration with duplicate ids', () => {
    const reg = new Registry<string, string>('testRegistry');
    reg.register('key', 'first');
    expect(() => reg.register('key', 'duplicate')).toThrow(/duplicate id/);
  });
});

describe('Hybrid Strategy & Role Archetypes', () => {
  it('provides configured profiles for all role archetypes', () => {
    const roles = ['Disruptor', 'Controller', 'Catcher', 'Support', 'Trickster', 'Bruiser', 'Speedster'];
    for (const r of roles) {
      const profile = getAiProfile(r);
      expect(profile.role).toBe(r);
      expect(profile.chaseBias).toBeGreaterThan(0);
      expect(profile.enemyAreaTolerance).toBeGreaterThan(0);

      const strat = getStrategyForRole(r);
      expect(strat).toBeDefined();
      expect(typeof strat.think).toBe('function');
    }
  });

  it('falls back cleanly to Default archetype for unknown roles', () => {
    const fallback = getAiProfile('UnknownRole');
    expect(fallback.role).toBe('Default');
    expect(fallback).toEqual(ROLE_ARCHETYPES.Default);
  });

  it('binds role-driven Hybrid AI strategies to each roaster in simulation', () => {
    const regs = createRegistries();
    const cfg = defaultMatchConfig(regs.roasters.ids(), 4, 9999);
    const sim = new Simulation(cfg, regs);

    expect(sim.aiStrategies).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const roaster = sim.roasters[i]!;
      const def = regs.roasters.get(roaster.roasterId);
      const expectedAi = getAiForRoaster(regs, def);
      expect(sim.aiOf(roaster)).toBe(expectedAi);
    }
  });

  it('supports seamless custom roaster injection into an unsealed registry', () => {
    const customRoasterId = roasterId('custom_blaze');
    const customRoaster = {
      id: customRoasterId,
      name: 'Blaze',
      ability: abilityId('sprinter'),
      stats: { moveSpeed: 4.6, pickupRadius: 1.1, carrySlots: 1, mass: 1.0 },
      sprite: spriteId('roaster_dash'),
      colors: { primary: 0xff4500, accent: 0xffd700 },
    };

    const customRegs = {
      roasters: new Registry<any, any>('roasters'),
      abilities: new Registry<any, any>('abilities'),
      arenas: new Registry<any, any>('arenas'),
      sprites: new Registry<any, any>('sprites'),
      sounds: new Registry<any, any>('sounds'),
      ai: new Registry<any, any>('ai'),
      archetypes: new Registry<any, any>('archetypes'),
    };

    const baseRegs = createRegistries();
    for (const [k, v] of baseRegs.roasters.entries()) customRegs.roasters.register(k, v);
    for (const [k, v] of baseRegs.abilities.entries()) customRegs.abilities.register(k, v);
    for (const [k, v] of baseRegs.arenas.entries()) customRegs.arenas.register(k, v);
    for (const [k, v] of baseRegs.sprites.entries()) customRegs.sprites.register(k, v);
    for (const [k, v] of baseRegs.sounds.entries()) customRegs.sounds.register(k, v);
    for (const [k, v] of baseRegs.ai.entries()) customRegs.ai.register(k, v);
    for (const [k, v] of baseRegs.archetypes.entries()) customRegs.archetypes.register(k, v);

    // Register custom character
    customRegs.roasters.register(customRoaster.id, customRoaster);
    customRegs.roasters.seal();

    const cfg = defaultMatchConfig([customRoasterId, ...baseRegs.roasters.ids().slice(0, 3)], 4, 4242);
    const sim = new Simulation(cfg, customRegs);

    // Simulate match with custom roaster
    for (let t = 0; t < 100; t++) sim.step();
    expect(sim.roasters[0]!.roasterId).toBe(customRoasterId);
    expect(sim.roasters[0]!.stats.moveSpeed).toBe(4.6);
  });
});
