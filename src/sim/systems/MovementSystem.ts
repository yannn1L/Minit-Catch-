import {
  CARRY_SPEED_MULT, CHANNEL_SPEED_MULT, CHICKEN_FLEE_RADIUS, CHICKEN_FLEE_SPEED, CHICKEN_PULL_SPEED,
  CHICKEN_WANDER_SPEED, TICK,
} from '../../domain/rules/constants.ts';
import { distSqPointSegment, segHit } from '../../domain/rules/geometry.ts';
import type { Chicken, Roaster } from '../../domain/entities/entities.ts';
import type { Simulation } from '../Simulation.ts';

const steer = { x: 0, y: 0 };
const KNOCK_DECAY = 0.85;
const SEPARATION_RADIUS = 1.2;
const ACCEL = 12; // 1/s smoothing for roaster velocity

/** Local steering: straight line, tangent detour around the first blocking pillar, soft separation. */
function computeSteer(sim: Simulation, r: Roaster, tx: number, ty: number): void {
  let dx = tx - r.x;
  let dy = ty - r.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) { steer.x = 0; steer.y = 0; return; }
  dx /= d;
  dy /= d;
  let aimX = dx;
  let aimY = dy;
  const obs = sim.arena.obstacles;
  let bestAlong = Infinity;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]!;
    const clear = o.r + r.radius + 0.35;
    const tdx = tx - o.x;
    const tdy = ty - o.y;
    if (tdx * tdx + tdy * tdy < (o.r + 0.3) * (o.r + 0.3)) continue; // target hugging the pillar: go straight
    if (distSqPointSegment(o.x, o.y, r.x, r.y, tx, ty) >= clear * clear) continue;
    const along = segHit.t * d;
    if (along >= bestAlong) continue;
    bestAlong = along;
    const cross = dx * (o.y - r.y) - dy * (o.x - r.x);
    const s = cross > 0 ? -1 : 1; // pillar on the left -> pass on the right
    const wx = o.x + -dy * s * (clear + 0.25);
    const wy = o.y + dx * s * (clear + 0.25);
    const ax = wx - r.x;
    const ay = wy - r.y;
    const al = Math.hypot(ax, ay) || 1;
    aimX = ax / al;
    aimY = ay / al;
  }
  let sx = 0;
  let sy = 0;
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const o = rs[i]!;
    if (o === r) continue;
    const ox = r.x - o.x;
    const oy = r.y - o.y;
    const dd = Math.hypot(ox, oy);
    if (dd >= SEPARATION_RADIUS || dd < 1e-6) continue;
    const w = ((SEPARATION_RADIUS - dd) / SEPARATION_RADIUS) * 1.2;
    sx += (ox / dd) * w;
    sy += (oy / dd) * w;
  }
  aimX += sx;
  aimY += sy;
  const l = Math.hypot(aimX, aimY) || 1;
  steer.x = aimX / l;
  steer.y = aimY / l;
}

function pushOutOfObstacles(sim: Simulation, x: number, y: number, radius: number, out: { x: number; y: number }): void {
  out.x = x;
  out.y = y;
  const obs = sim.arena.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]!;
    const dx = out.x - o.x;
    const dy = out.y - o.y;
    const min = o.r + radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    if (d < 1e-6) { out.x = o.x + min; continue; }
    out.x = o.x + (dx / d) * min;
    out.y = o.y + (dy / d) * min;
  }
  const lim = sim.arena.radius - radius - 0.2;
  const dc = Math.hypot(out.x, out.y);
  if (dc > lim) {
    out.x = (out.x / dc) * lim;
    out.y = (out.y / dc) * lim;
  }
}

const fix = { x: 0, y: 0 };

function moveRoasters(sim: Simulation): void {
  const t = sim.time;
  const rs = sim.roasters;
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    r.px = r.x;
    r.py = r.y;
    const stunned = t < r.stunUntil;
    const rooted = t < r.rootUntil;
    let dvx = 0;
    let dvy = 0;
    const dashing = r.dashLeft > 0;
    if (dashing) {
      dvx = r.dashDirX * r.dashSpeed;
      dvy = r.dashDirY * r.dashSpeed;
    } else if (!stunned && !rooted && r.intent.hasTarget) {
      computeSteer(sim, r, r.intent.tx, r.intent.ty);
      let speed = r.stats.moveSpeed;
      if (t < r.buffUntil) speed *= r.buffMult;
      if (r.carried >= 0) speed *= CARRY_SPEED_MULT;
      if (r.channelKind !== 0) speed *= CHANNEL_SPEED_MULT;
      dvx = steer.x * speed;
      dvy = steer.y * speed;
    }
    if (dashing) {
      r.vx = dvx;
      r.vy = dvy;
      r.dashLeft = Math.max(0, r.dashLeft - r.dashSpeed * TICK);
    } else {
      const a = Math.min(1, ACCEL * TICK);
      r.vx += (dvx - r.vx) * a;
      r.vy += (dvy - r.vy) * a;
    }
    r.x += (r.vx + r.kx) * TICK;
    r.y += (r.vy + r.ky) * TICK;
    r.kx *= KNOCK_DECAY;
    r.ky *= KNOCK_DECAY;
    if (Math.abs(r.kx) < 0.05) r.kx = 0;
    if (Math.abs(r.ky) < 0.05) r.ky = 0;
    const sp2 = r.vx * r.vx + r.vy * r.vy;
    if (sp2 > 0.09) {
      const sp = Math.sqrt(sp2);
      r.dirX = r.vx / sp;
      r.dirY = r.vy / sp;
    }
  }
  // roaster <-> roaster separation (mass weighted), then static geometry
  for (let i = 0; i < rs.length; i++) {
    const a = rs[i]!;
    for (let j = i + 1; j < rs.length; j++) {
      const b = rs[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      const overlap = min - d;
      const wa = b.stats.mass / (a.stats.mass + b.stats.mass);
      a.x -= nx * overlap * wa;
      a.y -= ny * overlap * wa;
      b.x += nx * overlap * (1 - wa);
      b.y += ny * overlap * (1 - wa);
    }
  }
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i]!;
    pushOutOfObstacles(sim, r.x, r.y, r.radius, fix);
    r.x = fix.x;
    r.y = fix.y;
  }
}

function moveChicken(sim: Simulation, c: Chicken): void {
  const t = sim.time;
  c.px = c.x;
  c.py = c.y;
  if (c.state === 'stored') return;
  if (c.state === 'carried') {
    const carrier = sim.roasters[c.carrier]!;
    c.x = carrier.x;
    c.y = carrier.y;
    return;
  }
  let tvx = 0;
  let tvy = 0;
  if (t < c.grabUntil) {
    // being picked up: frozen
  } else if (c.pullTo >= 0 && t < c.pullUntil) {
    const p = sim.roasters[c.pullTo]!;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.4) { tvx = (dx / d) * CHICKEN_PULL_SPEED; tvy = (dy / d) * CHICKEN_PULL_SPEED; }
  } else {
    c.pullTo = -1;
    let fx = 0;
    let fy = 0;
    const rs = sim.roasters;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i]!;
      const dx = c.x - r.x;
      const dy = c.y - r.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= CHICKEN_FLEE_RADIUS * CHICKEN_FLEE_RADIUS || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      const w = 1 - d / CHICKEN_FLEE_RADIUS;
      fx += (dx / d) * w;
      fy += (dy / d) * w;
    }
    const fl = Math.hypot(fx, fy);
    if (fl > 1e-6) {
      tvx = (fx / fl) * CHICKEN_FLEE_SPEED;
      tvy = (fy / fl) * CHICKEN_FLEE_SPEED;
      c.wanderUntil = 0;
    } else {
      if (t >= c.wanderUntil) {
        const rng = sim.rngAi;
        if (rng() < 0.35) {
          c.wanderX = c.x;
          c.wanderY = c.y; // idle peck
        } else {
          const a = rng() * Math.PI * 2;
          const r = 1 + rng() * 2.5;
          c.wanderX = c.x + Math.cos(a) * r;
          c.wanderY = c.y + Math.sin(a) * r;
        }
        c.wanderUntil = t + 0.8 + rng() * 1.6;
      }
      const dx = c.wanderX - c.x;
      const dy = c.wanderY - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.15) { tvx = (dx / d) * CHICKEN_WANDER_SPEED; tvy = (dy / d) * CHICKEN_WANDER_SPEED; }
    }
  }
  const a = Math.min(1, 8 * TICK);
  c.vx += (tvx - c.vx) * a;
  c.vy += (tvy - c.vy) * a;
  c.x += c.vx * TICK;
  c.y += c.vy * TICK;
  pushOutOfObstacles(sim, c.x, c.y, 0.25, fix);
  c.x = fix.x;
  c.y = fix.y;
}

export function movementSystem(sim: Simulation): void {
  moveRoasters(sim);
  const cs = sim.chickens;
  for (let i = 0; i < sim.chickenCount; i++) moveChicken(sim, cs[i]!);
}
