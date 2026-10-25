import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../src/domain/rules/constants.ts';
import { Simulation } from '../src/sim/Simulation.ts';
import { makeConfig, regs, runMatch } from './helpers.ts';

describe('simulation', () => {
  it('ends after 20 s (600 ticks) or overtime, with a result', () => {
    const sim = runMatch(makeConfig(4, 7));
    expect(sim.tick).toBeGreaterThanOrEqual(20 * TICK_RATE);
    expect(sim.tick).toBeLessThanOrEqual(25 * TICK_RATE);
    const r = sim.result();
    expect(r.scores).toHaveLength(4);
    expect(r.winnerSlot).toBeGreaterThanOrEqual(0);
  });

  it.each([2, 4, 7, 9, 12])('keeps invariants every tick with %i participants', (n) => {
    for (const arena of ['open', 'obstacle', ...(n >= 3 ? ['multi-spawn'] : [])]) {
      expect(() => runMatch(makeConfig(n, 31 * n, arena), true)).not.toThrow();
    }
  });

  it('never removes points from a coop and never exceeds one carried chicken', () => {
    const sim = new Simulation(makeConfig(9, 5), regs);
    const last = new Array<number>(9).fill(0);
    while (sim.step()) {
      for (const c of sim.coops) {
        expect(c.score).toBeGreaterThanOrEqual(last[c.slot]!);
        last[c.slot] = c.score;
      }
      const carried = sim.chickens.filter((c) => c.state === 'carried').length;
      expect(carried).toBeLessThanOrEqual(sim.roasters.length);
    }
  });

  it('final winner has the best tiebreak score', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = runMatch(makeConfig(4, seed));
      const r = sim.result();
      if (r.draw) continue;
      const w = r.scores[r.winnerSlot]!;
      for (const s of r.scores) expect(w.points).toBeGreaterThanOrEqual(s.points);
    }
  });

  it('rejects invalid configs with readable errors', () => {
    const bad = makeConfig(4, 1);
    bad.participants = 5;
    expect(() => new Simulation(bad, regs)).toThrow(/participants/);
    const zero = makeConfig(4, 1);
    zero.seed = 0;
    expect(() => new Simulation(zero, regs)).toThrow(/seed/);
  });

  it('registry misses give a clear message', () => {
    expect(() => regs.roasters.get('nope' as never)).toThrow(/unknown id "nope"/);
  });
});
