import { arenaId } from '../src/core/ids.ts';
import { createRegistries, type Registries } from '../src/data/registries.ts';
import { defaultMatchConfig } from '../src/domain/rules/defaults.ts';
import { Simulation } from '../src/sim/Simulation.ts';
import type { MatchConfig } from '../src/shared/types.ts';

export const regs: Registries = createRegistries();

export function makeConfig(participants = 4, seed = 12345, arena = 'open'): MatchConfig {
  const cfg = defaultMatchConfig(regs.roasters.ids(), participants, seed);
  cfg.arenaId = arenaId(arena);
  return cfg;
}

export function runMatch(cfg: MatchConfig, verify = false): Simulation {
  const sim = new Simulation(cfg, regs);
  while (sim.step()) if (verify) sim.verifyInvariants();
  return sim;
}
