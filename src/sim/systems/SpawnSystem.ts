import type { Simulation } from '../Simulation.ts';

export function spawnSystem(sim: Simulation): void {
  if (sim.time < sim.nextSpawnAt) return;
  const cs = sim.config.chickenSpawn;
  sim.nextSpawnAt += cs.interval;
  let onField = 0;
  for (let i = 0; i < sim.chickenCount; i++) if (sim.chickens[i]!.state !== 'stored') onField++;
  if (onField >= cs.cap) return;
  const rng = sim.streams.spawn;
  const pts = sim.arena.spawnPoints;
  const p = pts[Math.floor(rng() * pts.length)]!;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * 0.7;
  sim.spawnChicken(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
}
