import { describe, expect, it } from 'vitest';
import { hashEvents } from '../src/sim/EventLog.ts';
import { makeConfig, runMatch } from './helpers.ts';

// GDD: "hash event log identical across 1000 runs". Default is 100 for fast CI; `npm run test:determinism` runs 1000.
const RUNS = Number(process.env['DETERMINISM_RUNS'] ?? 100);

describe('determinism', () => {
  it(`produces an identical event-log hash across ${RUNS} runs`, () => {
    const cfg = makeConfig(7, 4242, 'obstacle');
    const first = hashEvents(runMatch(cfg).events.history);
    for (let i = 1; i < RUNS; i++) expect(hashEvents(runMatch(cfg).events.history)).toBe(first);
  }, 600_000);

  it('different seeds produce different matches', () => {
    const a = hashEvents(runMatch(makeConfig(4, 1)).events.history);
    const b = hashEvents(runMatch(makeConfig(4, 2)).events.history);
    expect(a).not.toBe(b);
  });

  it('result().eventHash matches an independent hash of the log (replay check)', () => {
    const sim = runMatch(makeConfig(9, 99, 'multi-spawn'));
    expect(sim.result().eventHash).toBe(hashEvents(sim.events.history));
  });
});
