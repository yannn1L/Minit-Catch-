import { dist2 } from '../rules/geometry.ts';
import { ENEMY_AREA_RADIUS } from '../rules/constants.ts';
import { TARGET_CHICKEN, TARGET_LURE, TARGET_NONE, type AiIntent, type Roaster } from '../entities/entities.ts';
import type { AiStrategy } from './ai.ts';
import { getAiProfile, ROLE_ARCHETYPES, type AiProfile } from './archetypes.ts';
import type { SimContext } from './context.ts';

// Shared scratch arrays (single-threaded simulation tick; never retained) => 0 allocations.
const ids = new Int32Array(256);
const RINGS = [4, 9, 18, 80] as const; // expanding spatial-hash query radii (m)
const STICKY = 0.6; // squared-distance multiplier for current target (hysteresis)

function inEnemyArea(ctx: SimContext, self: Roaster, x: number, y: number, toleranceMult = 1.0): boolean {
  const r = ENEMY_AREA_RADIUS * toleranceMult;
  const r2 = r * r;
  for (let i = 0; i < ctx.coops.length; i++) {
    const c = ctx.coops[i]!;
    if (c.slot !== self.slot && dist2(x, y, c.x, c.y) < r2) return true;
  }
  return false;
}

function chooseChase(self: Roaster, ctx: SimContext, it: AiIntent, profile: AiProfile): void {
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
      if (inEnemyArea(ctx, self, c.x, c.y, profile.enemyAreaTolerance)) continue;
      let d2 = dist2(self.x, self.y, c.x, c.y) * profile.chaseBias;
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
    let d2 = dist2(self.x, self.y, l.x, l.y) * profile.lureAttraction;
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

  // Anti-camp wander: if everything is contested/occupied, wander toward center
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

/**
 * Creates an archetype-driven Hybrid AI strategy combining spatial awareness with role weights.
 */
export function createHybridAi(profile: AiProfile = ROLE_ARCHETYPES.Default!): AiStrategy {
  return {
    think(self: Roaster, ctx: SimContext): AiIntent {
      const it = self.intent;
      it.cast = false;

      // Stunned: skip action
      if (ctx.time < self.stunUntil) {
        it.hasTarget = false;
        it.targetKind = TARGET_NONE;
        return it;
      }

      // Carrying chicken: navigate to own coop or loiter if coop is locked
      if (self.carried >= 0) {
        const coop = ctx.coops[self.slot]!;
        it.targetKind = TARGET_NONE;
        it.targetId = -1;
        it.hasTarget = true;
        if (ctx.time >= coop.lockUntil) {
          it.tx = coop.x;
          it.ty = coop.y;
        } else {
          const a = ctx.time * 1.5 + self.slot;
          it.tx = coop.x + Math.cos(a) * profile.lockLoiterRadius;
          it.ty = coop.y + Math.sin(a) * profile.lockLoiterRadius;
        }
      } else {
        chooseChase(self, ctx, it, profile);
      }

      // Tactical ability execution evaluation
      if (ctx.abilityOf(self).canUse(self, ctx)) {
        it.cast = true;
      }

      return it;
    },
  };
}

/** Default hybrid AI strategy instance */
export const hybridAi: AiStrategy = createHybridAi(ROLE_ARCHETYPES.Default!);

/** Factory map of pre-built role strategies */
export const ARCHETYPE_STRATEGIES: Readonly<Record<string, AiStrategy>> = {
  Disruptor: createHybridAi(ROLE_ARCHETYPES.Disruptor!),
  Controller: createHybridAi(ROLE_ARCHETYPES.Controller!),
  Catcher: createHybridAi(ROLE_ARCHETYPES.Catcher!),
  Support: createHybridAi(ROLE_ARCHETYPES.Support!),
  Trickster: createHybridAi(ROLE_ARCHETYPES.Trickster!),
  Bruiser: createHybridAi(ROLE_ARCHETYPES.Bruiser!),
  Speedster: createHybridAi(ROLE_ARCHETYPES.Speedster!),
  Default: hybridAi,
};

export function getStrategyForRole(role?: string): AiStrategy {
  if (!role) return hybridAi;
  return ARCHETYPE_STRATEGIES[role] ?? createHybridAi(getAiProfile(role));
}
