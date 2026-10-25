import { assert } from '../../core/assert.ts';
import { PICKUP_CHANNEL_SEC, TICK } from '../../domain/rules/constants.ts';
import { dist2 } from '../../domain/rules/geometry.ts';
import { refreshState } from '../../domain/rules/status.ts';
import { TARGET_CHICKEN, TARGET_LURE, TARGET_NONE, type Roaster } from '../../domain/entities/entities.ts';
import type { Simulation } from '../Simulation.ts';

const ids = new Int32Array(128);
const LEASH = 1.5; // a channel survives while the target stays within pickupRadius * LEASH

function channelValid(sim: Simulation, r: Roaster): boolean {
  const reach = r.stats.pickupRadius * LEASH;
  if (r.channelKind === TARGET_CHICKEN) {
    const c = sim.chickens[r.channelTarget]!;
    return c.state === 'free' && dist2(r.x, r.y, c.x, c.y) <= reach * reach;
  }
  const l = sim.lures[r.channelTarget]!;
  return l.alive && dist2(r.x, r.y, l.x, l.y) <= reach * reach;
}

function resetChannel(r: Roaster): void {
  r.channelKind = TARGET_NONE;
  r.channelTarget = -1;
  r.channelLeft = 0;
}

export function captureSystem(sim: Simulation): void {
  const t = sim.time;
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    if (t < r.stunUntil || r.carried >= 0 || r.dashLeft > 0) {
      if (r.channelKind !== TARGET_NONE) resetChannel(r);
      continue;
    }

    if (r.channelKind !== TARGET_NONE) {
      if (!channelValid(sim, r)) { resetChannel(r); continue; }
      if (r.channelKind === TARGET_CHICKEN) sim.chickens[r.channelTarget]!.grabUntil = t + TICK * 2;
      r.channelLeft -= TICK;
      if (r.channelLeft > 1e-9) continue;
      if (r.channelKind === TARGET_CHICKEN) {
        const c = sim.chickens[r.channelTarget]!;
        assert(c.state === 'free' && r.carried === -1, `capture invariant: chicken ${c.id} / roaster ${r.id}`);
        c.state = 'carried';
        c.carrier = r.id;
        c.pullTo = -1;
        r.carried = c.id;
        r.catches++;
        refreshState(r, t);
        sim.emit({ t: 'pickup', tick: sim.tick, roaster: r.id, chicken: c.id });
      } else {
        const l = sim.lures[r.channelTarget]!;
        l.alive = false; // fooled: the channel time is wasted
        sim.emit({ t: 'lureEnd', tick: sim.tick, id: l.id, x: l.x, y: l.y, consumedBy: r.id });
      }
      resetChannel(r);
      continue;
    }

    // look for something to start grabbing
    const reach = r.stats.pickupRadius;
    let bestKind: 0 | 1 | 2 = TARGET_NONE;
    let bestId = -1;
    let bestD2 = reach * reach;
    const n = sim.queryFreeChickens(r.x, r.y, reach, ids);
    for (let k = 0; k < n; k++) {
      const id = ids[k]!;
      const c = sim.chickens[id]!;
      const d2 = dist2(r.x, r.y, c.x, c.y);
      if (d2 < bestD2 || (d2 === bestD2 && id < bestId)) { bestD2 = d2; bestKind = TARGET_CHICKEN; bestId = id; }
    }
    for (let k = 0; k < sim.lures.length; k++) {
      const l = sim.lures[k]!;
      if (!l.alive || l.owner === r.id) continue;
      const d2 = dist2(r.x, r.y, l.x, l.y);
      if (d2 < bestD2) { bestD2 = d2; bestKind = TARGET_LURE; bestId = l.id; }
    }
    if (bestKind !== TARGET_NONE) {
      r.channelKind = bestKind;
      r.channelTarget = bestId;
      r.channelLeft = PICKUP_CHANNEL_SEC;
    }
  }
}
