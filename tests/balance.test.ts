import { describe, expect, it } from 'vitest';
import { ABILITY_DEFS } from '../src/data/abilities.ts';
import { MAX_STUN_SEC } from '../src/domain/rules/constants.ts';
import { coopSpawnSpread, validateArenaFairness } from '../src/domain/rules/arenaFairness.ts';
import { mulberry32 } from '../src/core/rng.ts';
import { defaultTiebreak } from '../src/domain/rules/scoring.ts';
import { ARENA_LAYOUTS } from '../src/data/arenas.ts';
import { makeConfig, regs, runMatch } from './helpers.ts';

describe('balance rules (GDD)', () => {
  it('ships 8 abilities, 8 roasters, 4 arenas, 12+ sfx', () => {
    expect(ABILITY_DEFS).toHaveLength(8);
    expect(regs.roasters.all()).toHaveLength(8);
    expect(regs.arenas.all().length).toBeGreaterThanOrEqual(4);
    expect(regs.sounds.all().length).toBeGreaterThanOrEqual(12);
  });

  it('max stun is <= 1.2 s and at least 2 abilities counter stun/drop', () => {
    expect(Math.max(...ABILITY_DEFS.map((d) => d.maxStunSec))).toBeLessThanOrEqual(MAX_STUN_SEC);
    expect(ABILITY_DEFS.filter((d) => d.countersDisable).length).toBeGreaterThanOrEqual(2);
  });

  it('carry slots are an invariant 1', () => {
    for (const r of regs.roasters.all()) expect(r.stats.carrySlots).toBe(1);
  });

  it('arena layouts are fair (equal coop->spawn distance) for every supported size', () => {
    for (const layout of ARENA_LAYOUTS) {
      for (let n = 2; n <= 12; n++) {
        if (!layout.supports(n)) continue;
        const a = layout.build(n, mulberry32(n * 17));
        expect(validateArenaFairness(a), `${layout.id}/${n}`).toEqual([]);
        expect(coopSpawnSpread(a)).toBeLessThan(1e-6);
      }
    }
  });

  it('tiebreak order: points > carried > earliest score', () => {
    const base = { slot: 0, points: 3, carried: 0, lastScoreTick: 100 };
    expect(defaultTiebreak.compare(base, { ...base, slot: 1, points: 2 })).toBeGreaterThan(0);
    expect(defaultTiebreak.compare({ ...base, carried: 1 }, { ...base, slot: 1 })).toBeGreaterThan(0);
    expect(defaultTiebreak.compare({ ...base, lastScoreTick: 90 }, { ...base, slot: 1 })).toBeGreaterThan(0);
    expect(defaultTiebreak.compare(base, { ...base, slot: 1 })).toBe(0);
  });

  it('no single roaster wins a dominant share across a seed sweep (smoke balance)', () => {
    const wins = new Map<string, number>();
    const N = 60;
    for (let i = 0; i < N; i++) {
      const cfg = makeConfig(8, 500 + i * 13);
      const ids = regs.roasters.ids();
      cfg.roasterIds = cfg.roasterIds.map((_, k) => ids[(k + i) % ids.length]!); // rotate slots to cancel position bias
      const r = runMatch(cfg).result();
      const id = cfg.roasterIds[r.winnerSlot]!;
      wins.set(id, (wins.get(id) ?? 0) + 1);
    }
    expect(Math.max(...wins.values()) / N).toBeLessThan(0.4);
  });
});
