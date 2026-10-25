import { TICK } from '../../domain/rules/constants.ts';
import { dist2 } from '../../domain/rules/geometry.ts';
import { refreshState } from '../../domain/rules/status.ts';
import type { Simulation } from '../Simulation.ts';

export function abilitySystem(sim: Simulation): void {
  const t = sim.time;
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    if (r.cooldownLeft > 0) r.cooldownLeft = Math.max(0, r.cooldownLeft - TICK);
    refreshState(r, t);
    const it = r.intent;
    if (!it.cast) continue;
    it.cast = false;
    const ability = sim.abilities[r.slot]!;
    if (!ability.canUse(r, sim)) continue;
    const hits = ability.use(r, sim);
    r.cooldownLeft = ability.cooldown;
    sim.emit({ t: 'ability', tick: sim.tick, roaster: r.id, ability: ability.id, x: r.x, y: r.y, dx: r.dirX, dy: r.dirY, hits });
  }

  const bombs = sim.bombs;
  for (let i = 0; i < bombs.length; i++) {
    const b = bombs[i]!;
    if (!b.alive || t < b.detonateAt) continue;
    b.alive = false;
    const r2 = b.radius * b.radius;
    let hits = 0;
    for (let j = 0; j < rs.length; j++) {
      const e = rs[j]!;
      if (e.id === b.owner || dist2(b.x, b.y, e.x, e.y) > r2) continue;
      if (sim.stun(e, b.stunSec, b.owner)) hits++;
    }
    sim.emit({ t: 'bomb', tick: sim.tick, x: b.x, y: b.y, radius: b.radius, owner: b.owner, hits });
  }

  const lures = sim.lures;
  for (let i = 0; i < lures.length; i++) {
    const l = lures[i]!;
    if (l.alive && t >= l.expiresAt) {
      l.alive = false;
      sim.emit({ t: 'lureEnd', tick: sim.tick, id: l.id, x: l.x, y: l.y, consumedBy: -1 });
    }
  }
}
