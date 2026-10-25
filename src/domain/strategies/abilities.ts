import type { AbilityId } from '../../core/ids.ts';
import { dist2 } from '../rules/geometry.ts';
import type { Roaster } from '../entities/entities.ts';
import type { AbilityStrategy } from './ability.ts';
import type { SimContext } from './context.ts';

// Shared scratch (single-threaded, never retained across calls) => zero allocation in tick.
const aim = { x: 0, y: 0 };
const ids = new Int32Array(256);

const ready = (s: Roaster, ctx: SimContext): boolean => s.cooldownLeft <= 0 && ctx.time >= s.stunUntil;

function nearestEnemy(self: Roaster, ctx: SimContext, maxDist: number, preferCarrier: boolean, skipShielded: boolean): Roaster | null {
  let best: Roaster | null = null;
  let bestD2 = maxDist * maxDist;
  for (let i = 0; i < ctx.roasters.length; i++) {
    const e = ctx.roasters[i]!;
    if (e.slot === self.slot) continue;
    if (skipShielded && ctx.isShielded(e)) continue;
    let d2 = dist2(self.x, self.y, e.x, e.y);
    if (preferCarrier && e.carried >= 0) d2 *= 0.5;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

// ------------------------------------------------------------------ bomber
export interface BomberParams { cooldown: number; stunSec: number; radius: number; range: number; fuse: number }
export function createBomber(id: AbilityId, p: BomberParams): AbilityStrategy {
  const r2 = p.radius * p.radius;
  const range2 = p.range * p.range;
  const findTarget = (self: Roaster, ctx: SimContext): boolean => {
    let bestScore = -Infinity;
    let found = false;
    for (let i = 0; i < ctx.roasters.length; i++) {
      const e = ctx.roasters[i]!;
      if (e.slot === self.slot || ctx.isShielded(e)) continue;
      const d2 = dist2(self.x, self.y, e.x, e.y);
      if (d2 > range2) continue;
      let count = 0;
      for (let j = 0; j < ctx.roasters.length; j++) {
        const o = ctx.roasters[j]!;
        if (o.slot !== self.slot && !ctx.isShielded(o) && dist2(e.x, e.y, o.x, o.y) <= r2) count++;
      }
      const score = count * 10 + (e.carried >= 0 ? 4 : 0) - Math.sqrt(d2) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        aim.x = e.x + e.vx * p.fuse;
        aim.y = e.y + e.vy * p.fuse;
        found = true;
      }
    }
    return found;
  };
  return {
    id,
    cooldown: p.cooldown,
    canUse: (self, ctx) => ready(self, ctx) && findTarget(self, ctx),
    use(self, ctx) {
      if (!findTarget(self, ctx)) return 0;
      ctx.plantBomb(aim.x, aim.y, p.fuse, p.radius, p.stunSec, self.id);
      return 0; // hits are reported by the 'bomb' detonation event
    },
  };
}

// ------------------------------------------------------------------ netter
export interface NetterParams { cooldown: number; rootSec: number; range: number; halfAngleDeg: number }
export function createNetter(id: AbilityId, p: NetterParams): AbilityStrategy {
  const cosHalf = Math.cos((p.halfAngleDeg * Math.PI) / 180);
  const aimAt = (self: Roaster, ctx: SimContext): boolean => {
    const e = nearestEnemy(self, ctx, p.range, true, true);
    if (e === null) return false;
    const dx = e.x - self.x;
    const dy = e.y - self.y;
    const d = Math.hypot(dx, dy) || 1;
    aim.x = dx / d;
    aim.y = dy / d;
    return true;
  };
  return {
    id,
    cooldown: p.cooldown,
    canUse: (self, ctx) => ready(self, ctx) && aimAt(self, ctx),
    use(self, ctx) {
      if (!aimAt(self, ctx)) return 0;
      const ax = aim.x;
      const ay = aim.y;
      let hits = 0;
      for (let i = 0; i < ctx.roasters.length; i++) {
        const e = ctx.roasters[i]!;
        if (e.slot === self.slot) continue;
        const dx = e.x - self.x;
        const dy = e.y - self.y;
        const d = Math.hypot(dx, dy);
        if (d > p.range || d < 1e-6) continue;
        if ((dx * ax + dy * ay) / d < cosHalf) continue;
        if (ctx.root(e, p.rootSec, self.id)) hits++;
      }
      self.dirX = ax;
      self.dirY = ay;
      return hits;
    },
  };
}

// ------------------------------------------------------------------ sprinter
export interface SprinterParams { cooldown: number; dashDist: number; dashSpeed: number; buffSec: number; buffMult: number; minTravel: number }
export function createSprinter(id: AbilityId, p: SprinterParams): AbilityStrategy {
  return {
    id,
    cooldown: p.cooldown,
    canUse(self, ctx) {
      if (!ready(self, ctx) || self.dashLeft > 0 || !self.intent.hasTarget || self.channelLeft > 0) return false;
      return dist2(self.x, self.y, self.intent.tx, self.intent.ty) >= p.minTravel * p.minTravel;
    },
    use(self, ctx) {
      const dx = self.intent.tx - self.x;
      const dy = self.intent.ty - self.y;
      const d = Math.hypot(dx, dy) || 1;
      self.dashDirX = dx / d;
      self.dashDirY = dy / d;
      self.dashLeft = Math.min(p.dashDist, d);
      self.dashSpeed = p.dashSpeed;
      self.buffUntil = ctx.time + p.buffSec;
      self.buffMult = p.buffMult;
      // Counter to stun/drop: invulnerable while dashing (+ a short grace).
      ctx.grantShield(self, p.dashDist / p.dashSpeed + 0.15);
      return 0;
    },
  };
}

// ------------------------------------------------------------------ magnetizer
export interface MagnetizerParams { cooldown: number; radius: number; pullSec: number; minChickens: number }
export function createMagnetizer(id: AbilityId, p: MagnetizerParams): AbilityStrategy {
  return {
    id,
    cooldown: p.cooldown,
    canUse: (self, ctx) =>
      ready(self, ctx) && self.carried < 0 && ctx.queryFreeChickens(self.x, self.y, p.radius, ids) >= p.minChickens,
    use(self, ctx) {
      const n = ctx.queryFreeChickens(self.x, self.y, p.radius, ids);
      for (let i = 0; i < n; i++) {
        const c = ctx.chickens[ids[i]!]!;
        c.pullTo = self.id;
        c.pullUntil = ctx.time + p.pullSec;
      }
      return n;
    },
  };
}

// ------------------------------------------------------------------ guardian
export interface GuardianParams { cooldown: number; shieldSec: number; threatRadius: number }
export function createGuardian(id: AbilityId, p: GuardianParams): AbilityStrategy {
  return {
    id,
    cooldown: p.cooldown,
    canUse(self, ctx) {
      if (!ready(self, ctx) || ctx.isShielded(self)) return false;
      const near = nearestEnemy(self, ctx, p.threatRadius, false, false);
      if (near === null) return false;
      return self.carried >= 0 || dist2(self.x, self.y, near.x, near.y) < p.threatRadius * p.threatRadius * 0.25;
    },
    use(self, ctx) {
      ctx.grantShield(self, p.shieldSec);
      return 1;
    },
  };
}

// ------------------------------------------------------------------ trickster
export interface TricksterParams { cooldown: number; lureSec: number; distance: number; baitRange: number }
export function createTrickster(id: AbilityId, p: TricksterParams): AbilityStrategy {
  return {
    id,
    cooldown: p.cooldown,
    canUse(self, ctx) {
      if (!ready(self, ctx) || self.carried >= 0) return false;
      const e = nearestEnemy(self, ctx, p.baitRange, false, false);
      return e !== null && e.carried < 0 && ctx.time >= e.stunUntil;
    },
    use(self, ctx) {
      let x = self.x + self.dirX * p.distance;
      let y = self.y + self.dirY * p.distance;
      const lim = ctx.arena.radius - 1;
      const d = Math.hypot(x, y);
      if (d > lim) {
        x = (x / d) * lim;
        y = (y / d) * lim;
      }
      ctx.spawnLure(x, y, p.lureSec, self.id);
      return 0;
    },
  };
}

// ------------------------------------------------------------------ saboteur
export interface SaboteurParams { cooldown: number; lockSec: number; threatRadius: number }
export function createSaboteur(id: AbilityId, p: SaboteurParams): AbilityStrategy {
  const pickCoop = (self: Roaster, ctx: SimContext): number => {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < ctx.coops.length; i++) {
      const c = ctx.coops[i]!;
      if (c.slot === self.slot || ctx.time < c.lockUntil) continue;
      const owner = ctx.roasters[c.slot]!;
      let score = c.score * 0.5;
      if (owner.carried >= 0 && dist2(owner.x, owner.y, c.x, c.y) <= p.threatRadius * p.threatRadius) score += 5; // deny an imminent deposit
      if (score > bestScore) {
        bestScore = score;
        best = c.slot;
      }
    }
    return best;
  };
  return {
    id,
    cooldown: p.cooldown,
    canUse: (self, ctx) => ready(self, ctx) && pickCoop(self, ctx) >= 0,
    use(self, ctx) {
      const slot = pickCoop(self, ctx);
      if (slot < 0) return 0;
      ctx.lockCoop(slot, p.lockSec, self.id);
      return 1;
    },
  };
}

// ------------------------------------------------------------------ heavy
export interface HeavyParams { cooldown: number; radius: number; knock: number }
export function createHeavy(id: AbilityId, p: HeavyParams): AbilityStrategy {
  const r2 = p.radius * p.radius;
  return {
    id,
    cooldown: p.cooldown,
    canUse(self, ctx) {
      if (!ready(self, ctx)) return false;
      for (let i = 0; i < ctx.roasters.length; i++) {
        const e = ctx.roasters[i]!;
        if (e.slot !== self.slot && !ctx.isShielded(e) && dist2(self.x, self.y, e.x, e.y) <= r2 * 0.64) return true;
      }
      return false;
    },
    use(self, ctx) {
      let hits = 0;
      for (let i = 0; i < ctx.roasters.length; i++) {
        const e = ctx.roasters[i]!;
        if (e.slot === self.slot) continue;
        const d2 = dist2(self.x, self.y, e.x, e.y);
        if (d2 > r2) continue;
        const d = Math.sqrt(d2) || 1;
        const k = p.knock / e.stats.mass;
        let dx = (e.x - self.x) / d;
        let dy = (e.y - self.y) / d;
        if (d2 < 1e-8) { dx = self.dirX; dy = self.dirY; }
        if (ctx.knockback(e, dx * k, dy * k, self.id)) hits++;
      }
      return hits;
    },
  };
}
