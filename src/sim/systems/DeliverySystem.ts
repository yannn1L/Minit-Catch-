import { assert } from '../../core/assert.ts';
import { dist2 } from '../../domain/rules/geometry.ts';
import { refreshState } from '../../domain/rules/status.ts';
import type { Simulation } from '../Simulation.ts';

/** Instant deposit into the roaster's own, unlocked coop. Points are locked in (never removed). */
export function deliverySystem(sim: Simulation): void {
  const t = sim.time;
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    if (r.carried < 0 || t < r.stunUntil) continue;
    let coop = sim.coops[r.slot]!;
    if (sim.isTagTeam) {
      const myTeam = sim.teamOf(r.slot);
      let found = false;
      for (let j = 0; j < sim.coops.length; j++) {
        const cCandidate = sim.coops[j]!;
        if (sim.teamOf(cCandidate.slot) !== myTeam) continue;
        if (t < cCandidate.lockUntil) continue;
        if (dist2(r.x, r.y, cCandidate.x, cCandidate.y) <= cCandidate.radius * cCandidate.radius) {
          coop = cCandidate;
          found = true;
          break;
        }
      }
      if (!found) continue;
    } else {
      if (t < coop.lockUntil) continue;
      if (dist2(r.x, r.y, coop.x, coop.y) > coop.radius * coop.radius) continue;
    }

    const c = sim.chickens[r.carried]!;
    assert(c.state === 'carried' && c.carrier === r.id, `delivery invariant: chicken ${c.id} / roaster ${r.id}`);
    c.state = 'stored';
    c.carrier = -1;
    c.x = coop.x;
    c.y = coop.y;
    c.px = coop.x;
    c.py = coop.y;
    r.carried = -1;
    r.delivered++;
    coop.score++;
    coop.lastScoreTick = sim.tick;
    refreshState(r, t);
    sim.emit({ t: 'deliver', tick: sim.tick, roaster: r.id, chicken: c.id, coop: coop.id, score: coop.score });
  }
}
