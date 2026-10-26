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

  it('supports Tag Team matches from 2v2 up to 10v10 (20 participants)', () => {
    // 2v2 (4 participants)
    const tag2v2 = makeConfig(4, 9876);
    tag2v2.mode = 'tag_team';
    tag2v2.teamSize = 2;
    const sim2v2 = runMatch(tag2v2, true);
    const res2v2 = sim2v2.result();
    expect(res2v2.mode).toBe('tag_team');
    expect(res2v2.teamScores).toBeDefined();
    expect(res2v2.teamScores![0] + res2v2.teamScores![1]).toBeGreaterThanOrEqual(0);

    // 10v10 (20 participants)
    const tag10v10 = makeConfig(20, 54321);
    tag10v10.mode = 'tag_team';
    tag10v10.teamSize = 10;
    const sim10v10 = runMatch(tag10v10, true);
    const res10v10 = sim10v10.result();
    expect(res10v10.mode).toBe('tag_team');
    expect(res10v10.scores).toHaveLength(20);
    expect(res10v10.teamScores).toBeDefined();
  });
});
