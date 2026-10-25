import { dist2 } from '../rules/geometry.ts';
import { ENEMY_AREA_RADIUS } from '../rules/constants.ts';
import { TARGET_CHICKEN, TARGET_LURE, TARGET_NONE, type AiIntent, type Roaster } from '../entities/entities.ts';
import type { AiStrategy } from './ai.ts';
import type { SimContext } from './context.ts';

const ids = new Int32Array(256);
const RINGS = [4, 9, 18, 80] as const; // expanding spatial-hash query radii (m)
const STICKY = 0.6; // squared-distance multiplier for the current target (hysteresis)

function inEnemyArea(ctx: SimContext, self: Roaster, x: number, y: number): boolean {
  const r2 = ENEMY_AREA_RADIUS * ENEMY_AREA_RADIUS;
  for (let i = 0; i < ctx.coops.length; i++) {
    const c = ctx.coops[i]!;
    if (c.slot !== self.slot && dist2(x, y, c.x, c.y) < r2) return true;
  }
  return false;
}

function chooseChase(self: Roaster, ctx: SimContext, it: AiIntent): void {
  let bestD2 = Infinity;
  let kind: 0 | 1 | 2 = TARGET_NONE;
  let bestId = -1;
  let bx = 0;
  let by = 0;
  for (let ri = 0; ri < RINGS.length; ri++) {
    const n = ctx.queryFreeChickens(self.x, self.y, RINGS[ri]!, ids);
    for (let k = 0; k < n; k++) {
      const id = ids[k]!;
      const c = ctx.chickens[id]!;
      if (inEnemyArea(ctx, self, c.x, c.y)) continue;
      let d2 = dist2(self.x, self.y, c.x, c.y);
      if (it.targetKind === TARGET_CHICKEN && it.targetId === id) d2 *= STICKY;
      if (d2 < bestD2 || (d2 === bestD2 && id < bestId)) {
        bestD2 = d2;
        kind = TARGET_CHICKEN;
        bestId = id;
        bx = c.x;
        by = c.y;
      }
    }
    if (kind !== TARGET_NONE && bestD2 <= RINGS[ri]! * RINGS[ri]!) break;
  }
  for (let i = 0; i < ctx.lures.length; i++) {
    const l = ctx.lures[i]!;
    if (!l.alive || l.owner === self.id) continue;
    let d2 = dist2(self.x, self.y, l.x, l.y) * 0.8; // bait looks slightly tastier
    if (it.targetKind === TARGET_LURE && it.targetId === l.id) d2 *= STICKY;
    if (d2 < bestD2) {
      bestD2 = d2;
      kind = TARGET_LURE;
      bestId = l.id;
      bx = l.x;
      by = l.y;
    }
  }
  if (kind !== TARGET_NONE) {
    it.hasTarget = true;
    it.targetKind = kind;
    it.targetId = bestId;
    it.tx = bx;
    it.ty = by;
    return;
  }
  // Anti-camp: everything is in enemy territory -> wander through the middle until something frees up.
  it.targetKind = TARGET_NONE;
  it.targetId = -1;
  if (ctx.time >= it.wanderUntil) {
    const a = ctx.rngAi() * Math.PI * 2;
    const r = Math.sqrt(ctx.rngAi()) * ctx.arena.radius * 0.5;
    it.wx = Math.cos(a) * r;
    it.wy = Math.sin(a) * r;
    it.wanderUntil = ctx.time + 1.5 + ctx.rngAi();
  }
  it.hasTarget = true;
  it.tx = it.wx;
  it.ty = it.wy;
}

/** Utility priority (GDD): stunned->skip; carrying->deliver; ability+cluster->cast; nearest chicken; anti-camp wander. */
export const utilityAi: AiStrategy = {
  think(self, ctx) {
    const it = self.intent;
    it.cast = false;
    if (ctx.time < self.stunUntil) {
      it.hasTarget = false;
      it.targetKind = TARGET_NONE;
      return it;
    }
    if (self.carried >= 0) {
      const coop = ctx.coops[self.slot]!;
      it.targetKind = TARGET_NONE;
      it.targetId = -1;
      it.hasTarget = true;
      if (ctx.time >= coop.lockUntil) {
        it.tx = coop.x;
        it.ty = coop.y;
      } else {
        const a = ctx.time * 1.5 + self.slot; // coop locked: loiter nearby instead of ramming the door
        it.tx = coop.x + Math.cos(a) * 2.6;
        it.ty = coop.y + Math.sin(a) * 2.6;
      }
    } else {
      chooseChase(self, ctx, it);
    }
    // Cast check runs after movement choice (casting never blocks movement; sprinter needs the fresh target).
    if (ctx.abilityOf(self).canUse(self, ctx)) it.cast = true;
    return it;
  },
};
