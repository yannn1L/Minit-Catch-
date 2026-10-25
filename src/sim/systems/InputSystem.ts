import type { Simulation } from '../Simulation.ts';

/** Intentionally empty: the match has no player input. Slot reserved for recorded input during replay. */
export function inputSystem(_sim: Simulation): void {}
