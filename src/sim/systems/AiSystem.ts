import { AI_PERIOD_TICKS, TICK } from '../../domain/rules/constants.ts';
import type { Simulation } from '../Simulation.ts';

/** Strategy per roaster; staggered by id so the AI cost is spread across ticks. */
export function aiSystem(sim: Simulation): void {
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    if ((sim.tick + r.id) % AI_PERIOD_TICKS !== 0) continue;
    sim.ai.think(r, sim, TICK * AI_PERIOD_TICKS);
  }
}
