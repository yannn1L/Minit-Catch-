import type { Simulation } from '../Simulation.ts';

export function spatialHashSystem(sim: Simulation): void {
  sim.hash.rebuild(sim.chickens, sim.chickenCount);
}
