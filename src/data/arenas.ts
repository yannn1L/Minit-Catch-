import { arenaId, type ArenaId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { Rng } from '../core/rng.ts';
import { TAU } from '../core/math.ts';
import { arenaRadius, COOP_RADIAL, MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../domain/rules/constants.ts';
import type { ArenaLayout, ArenaLayoutResult, Obstacle } from '../domain/strategies/arena.ts';
import type { Vec2 } from '../shared/types.ts';

interface RingSpec {
  /** fraction of arena radius */
  readonly at: number;
  /** false: aligned with coops; true: halfway between two coops */
  readonly between: boolean;
}

interface LayoutSpec {
  readonly rings: readonly RingSpec[];
  readonly pillars: (n: number, radius: number) => { at: number; r: number } | null;
}

/**
 * Radial rules (GDD): coops on the perimeter at equal angles, roasters spawn at their coop,
 * chickens on a center ring + outer ring(s). Every ring holds exactly `n` points and every pillar
 * ring repeats per coop angle, so the layout is rotationally symmetric => fair by construction.
 */
function buildRadial(n: number, rng: Rng, spec: LayoutSpec): ArenaLayoutResult {
  const radius = arenaRadius(n);
  const step = TAU / n;
  const phase = rng() * step; // random global rotation: variety without breaking symmetry
  const coops: { x: number; y: number; angle: number }[] = [];
  const roasterSpawns: Vec2[] = [];
  const coopR = radius * COOP_RADIAL;
  for (let i = 0; i < n; i++) {
    const a = phase + i * step;
    coops.push({ x: Math.cos(a) * coopR, y: Math.sin(a) * coopR, angle: a });
    roasterSpawns.push({ x: Math.cos(a) * (coopR - 2.4), y: Math.sin(a) * (coopR - 2.4) });
  }
  const spawnPoints: Vec2[] = [];
  for (const ring of spec.rings) {
    for (let i = 0; i < n; i++) {
      const a = phase + (i + (ring.between ? 0.5 : 0)) * step;
      spawnPoints.push({ x: Math.cos(a) * radius * ring.at, y: Math.sin(a) * radius * ring.at });
    }
  }
  const obstacles: Obstacle[] = [];
  const p = spec.pillars(n, radius);
  if (p !== null) {
    for (let i = 0; i < n; i++) {
      const a = phase + i * step;
      obstacles.push({ x: Math.cos(a) * radius * p.at, y: Math.sin(a) * radius * p.at, r: p.r });
    }
  }
  return { radius, coops, roasterSpawns, spawnPoints, obstacles };
}

const inRange = (n: number): boolean => n >= MIN_PARTICIPANTS && n <= MAX_PARTICIPANTS;

export const ARENA_LAYOUTS: readonly ArenaLayout[] = [
  {
    id: arenaId('open'),
    name: 'Open Yard',
    supports: inRange,
    build: (n, rng) => buildRadial(n, rng, { rings: [{ at: 0.3, between: false }, { at: 0.6, between: true }], pillars: () => null }),
  },
  {
    id: arenaId('obstacle'),
    name: 'Pillar Ring',
    supports: inRange,
    build: (n, rng) =>
      buildRadial(n, rng, {
        rings: [{ at: 0.22, between: true }, { at: 0.64, between: true }],
        pillars: (_n, radius) => ({ at: 0.45, r: Math.min(1.6, Math.max(0.9, radius * 0.09)) }),
      }),
  },
  {
    id: arenaId('multi-spawn'),
    name: 'Triple Spawn',
    supports: (n) => inRange(n) && n >= 3,
    build: (n, rng) =>
      buildRadial(n, rng, { rings: [{ at: 0.3, between: false }, { at: 0.5, between: true }, { at: 0.68, between: true }], pillars: () => null }),
  },
  {
    id: arenaId('crossfire'),
    name: 'Crossfire',
    supports: inRange,
    build: (n, rng) =>
      buildRadial(n, rng, {
        rings: [{ at: 0.25, between: false }, { at: 0.68, between: true }],
        pillars: (_n, radius) => ({ at: 0.46, r: Math.min(1.3, Math.max(0.7, radius * 0.075)) }),
      }),
  },
];

export function registerArenas(reg: Registry<ArenaId, ArenaLayout>): void {
  for (const l of ARENA_LAYOUTS) reg.register(l.id, l);
}
