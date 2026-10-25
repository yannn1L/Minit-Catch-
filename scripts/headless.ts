// Headless smoke/balance harness: `node scripts/headless.ts [runs] [participants] [arena]` (Node >= 22.18, native TS stripping).
import { createRegistries } from '../src/data/registries.ts';
import { defaultMatchConfig } from '../src/domain/rules/defaults.ts';
import { arenaId } from '../src/core/ids.ts';
import { Simulation } from '../src/sim/Simulation.ts';

const runs = Number(process.argv[2] ?? 5);
const n = Number(process.argv[3] ?? 4);
const arena = process.argv[4] ?? 'open';
const regs = createRegistries();
const roasterIds = regs.roasters.ids();
const wins = new Map<string, number>();
const t0 = performance.now();
let ticks = 0;
for (let i = 0; i < runs; i++) {
  const cfg = defaultMatchConfig(roasterIds, n, 1000 + i * 7919);
  cfg.arenaId = arenaId(arena);
  // rotate roster so every roaster gets slot variety
  cfg.roasterIds = cfg.roasterIds.map((_, k) => roasterIds[(k + i) % roasterIds.length]!);
  const sim = new Simulation(cfg, regs);
  while (sim.step()) { sim.verifyInvariants(); ticks++; }
  const r = sim.result();
  const w = cfg.roasterIds[r.winnerSlot]!;
  wins.set(w, (wins.get(w) ?? 0) + 1);
  if (i < 3) console.log(`seed ${cfg.seed}: scores=${r.scores.map((s) => s.points).join(',')} winner=${w} ot=${r.overtime} stuns=${r.stuns.join(',')} catches=${r.catches.join(',')} hash=${r.eventHash} events=${sim.events.history.length}`);
}
const ms = performance.now() - t0;
console.log(`runs=${runs} ticks=${ticks} avg tick ${(ms / ticks).toFixed(3)} ms`);
console.log('wins', Object.fromEntries(wins));
