import { assert } from '../core/assert.ts';
import type { AbilityId, ArenaId, RoasterId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import { createStreams, type Rng, type RngStreams } from '../core/rng.ts';
import {
  OVERTIME_SEC, MAX_BOMBS, MAX_LURES, ROASTER_RADIUS, TICK, TICK_RATE,
} from '../domain/rules/constants.ts';
import { defaultTiebreak } from '../domain/rules/scoring.ts';
import { applyStunTimer, refreshState } from '../domain/rules/status.ts';
import { validateMatchConfig } from '../domain/rules/validation.ts';
import {
  createIntent, type Bomb, type Chicken, type Coop, type Lure, type Roaster,
} from '../domain/entities/entities.ts';
import type { AbilityStrategy } from '../domain/strategies/ability.ts';
import { getAbilityDef } from '../data/abilities.ts';
import { getStrategyForRole, type AiStrategy } from '../domain/strategies/ai.ts';
import type { ArenaLayout, ArenaLayoutResult } from '../domain/strategies/arena.ts';
import type { SimContext } from '../domain/strategies/context.ts';
import type { TiebreakStrategy } from '../domain/strategies/tiebreak.ts';
import { utilityAi } from '../domain/strategies/utilityAi.ts';
import type { DropReason, MatchConfig, MatchResult, RoasterDef, Score, SimEvent } from '../shared/types.ts';
import { EventLog, hashEvents } from './EventLog.ts';
import { SpatialHash } from './SpatialHash.ts';
import { abilitySystem } from './systems/AbilitySystem.ts';
import { aiSystem } from './systems/AiSystem.ts';
import { captureSystem } from './systems/CaptureSystem.ts';
import { deliverySystem } from './systems/DeliverySystem.ts';
import { inputSystem } from './systems/InputSystem.ts';
import { movementSystem } from './systems/MovementSystem.ts';
import { scoringSystem } from './systems/ScoringSystem.ts';
import { spatialHashSystem } from './systems/SpatialHashSystem.ts';
import { spawnSystem } from './systems/SpawnSystem.ts';

export type SimPhase = 'active' | 'overtime' | 'ended';

export interface SimRegistries {
  readonly roasters: Registry<RoasterId, RoasterDef>;
  readonly abilities: Registry<AbilityId, AbilityStrategy>;
  readonly arenas: Registry<ArenaId, ArenaLayout>;
  readonly ai?: Registry<string, AiStrategy>;
}

/** Read-only facade handed to presentation (no copying, no mutation through the type). */
export interface SimView {
  readonly tick: number;
  readonly time: number;
  readonly durationSec: number;
  readonly phase: SimPhase;
  readonly arena: ArenaLayoutResult;
  readonly roasters: readonly Readonly<Roaster>[];
  readonly chickens: readonly Readonly<Chicken>[];
  readonly chickenCount: number;
  readonly coops: readonly Readonly<Coop>[];
  readonly lures: readonly Readonly<Lure>[];
  readonly bombs: readonly Readonly<Bomb>[];
}

export class Simulation implements SimContext, SimView {
  readonly config: MatchConfig;
  readonly durationSec: number;
  readonly arena: ArenaLayoutResult;
  readonly roasters: Roaster[] = [];
  readonly chickens: Chicken[] = [];
  readonly coops: Coop[] = [];
  readonly lures: Lure[] = [];
  readonly bombs: Bomb[] = [];
  readonly events = new EventLog();
  readonly streams: RngStreams;
  readonly rngAi: Rng;
  readonly rngAbility: Rng;
  readonly hash: SpatialHash;
  readonly abilities: AbilityStrategy[] = [];
  readonly aiStrategies: AiStrategy[] = [];
  readonly ai: AiStrategy = utilityAi;
  readonly tiebreak: TiebreakStrategy = defaultTiebreak;

  tick = 0;
  time = 0;
  phase: SimPhase = 'active';
  chickenCount = 0; // chickens spawned so far (pool is filled sequentially)
  nextSpawnAt: number;
  readonly endTick: number;
  overtimeEndTick = 0;
  tiedSlots: number[] = [];
  tiedPoints = 0;
  winnerSlot = -1;
  draw = false;
  overtime = false;
  private lastScoreSum = 0;

  constructor(config: MatchConfig, regs: SimRegistries) {
    const errs = validateMatchConfig(config, regs);
    if (errs.length > 0) throw new Error(`Invalid MatchConfig:\n - ${errs.join('\n - ')}`);
    this.config = config;
    this.durationSec = config.durationSec;
    this.endTick = Math.round(config.durationSec * TICK_RATE);
    this.streams = createStreams(config.seed);
    this.rngAi = this.streams.ai;
    this.rngAbility = this.streams.ability;

    const n = config.participants;
    this.arena = regs.arenas.get(config.arenaId).build(n, this.streams.spawn);
    assert(this.arena.coops.length === n && this.arena.roasterSpawns.length === n, 'arena must provide one coop and spawn per participant');

    for (let i = 0; i < n; i++) {
      const def = regs.roasters.get(config.roasterIds[i]!);
      const ability = regs.abilities.get(def.ability);
      const role = getAbilityDef(def.ability)?.role;
      const aiStrat = regs.ai?.tryGet(role ?? 'Default') ?? getStrategyForRole(role);
      const sp = this.arena.roasterSpawns[i]!;
      const slot = this.arena.coops[i]!;
      this.abilities.push(ability);
      this.aiStrategies.push(aiStrat);
      this.roasters.push({
        id: i, slot: i, roasterId: def.id, abilityId: def.ability, stats: def.stats, radius: ROASTER_RADIUS,
        x: sp.x, y: sp.y, px: sp.x, py: sp.y, vx: 0, vy: 0, kx: 0, ky: 0,
        dirX: -slot.x / (Math.hypot(slot.x, slot.y) || 1), dirY: -slot.y / (Math.hypot(slot.x, slot.y) || 1),
        state: 'idle', stunUntil: 0, rootUntil: 0, shieldUntil: 0, buffUntil: 0, buffMult: 1,
        dashLeft: 0, dashDirX: 0, dashDirY: 0, dashSpeed: 0,
        cooldownLeft: ability.cooldown * 0.4, // opening cooldown avoids tick-0 ability dumps
        carried: -1, channelKind: 0, channelTarget: -1, channelLeft: 0,
        intent: createIntent(), catches: 0, stuns: 0, delivered: 0,
      });
      this.coops.push({ id: i, slot: i, x: slot.x, y: slot.y, angle: slot.angle, radius: 1.8, score: 0, lockUntil: 0, lastScoreTick: -1 });
    }

    const cs = config.chickenSpawn;
    const capacity = cs.initial + Math.ceil((config.durationSec + OVERTIME_SEC) / cs.interval) + 2;
    for (let i = 0; i < capacity; i++) {
      this.chickens.push({
        id: i, alive: false, state: 'free', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
        wanderX: 0, wanderY: 0, wanderUntil: 0, carrier: -1, pullTo: -1, pullUntil: 0, grabUntil: 0,
      });
    }
    for (let i = 0; i < MAX_LURES; i++) this.lures.push({ id: i, alive: false, x: 0, y: 0, owner: -1, expiresAt: 0 });
    for (let i = 0; i < MAX_BOMBS; i++) this.bombs.push({ alive: false, x: 0, y: 0, owner: -1, detonateAt: 0, radius: 0, stunSec: 0 });

    this.hash = new SpatialHash(this.arena.radius, 2, capacity);
    this.nextSpawnAt = cs.interval;
    this.emit({ t: 'start', tick: 0, participants: n });
    const sp = this.streams.spawn;
    const pts = this.arena.spawnPoints;
    for (let i = 0; i < cs.initial; i++) {
      const p = pts[i % pts.length]!;
      const a = sp() * Math.PI * 2;
      const r = Math.sqrt(sp()) * 0.7;
      this.spawnChicken(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
    }
    this.hash.rebuild(this.chickens, this.chickenCount);
  }

  get ended(): boolean {
    return this.phase === 'ended';
  }

  get view(): SimView {
    return this;
  }

  /** One fixed 1/30 s step. Returns false once the match has ended. */
  step(): boolean {
    if (this.phase === 'ended') return false;
    this.tick++;
    this.time = this.tick * TICK;
    inputSystem(this);
    spawnSystem(this); // Decision: GDD systemOrder has no spawner; inserted right after InputSystem.
    aiSystem(this);
    abilitySystem(this);
    movementSystem(this);
    captureSystem(this);
    deliverySystem(this);
    scoringSystem(this);
    spatialHashSystem(this);
    this.events.flush();
    return !this.ended; // getter defeats TS control-flow narrowing of `phase` (mutated by systems)
  }

  // ------------------------------------------------------------ SimContext
  abilityOf(r: Roaster): AbilityStrategy {
    return this.abilities[r.slot]!;
  }

  aiOf(r: Roaster): AiStrategy {
    return this.aiStrategies[r.slot] ?? this.ai;
  }

  isShielded(r: Roaster): boolean {
    return this.time < r.shieldUntil;
  }

  queryFreeChickens(x: number, y: number, radius: number, out: Int32Array): number {
    return this.hash.query(this.chickens, x, y, radius, out);
  }

  emit(ev: SimEvent): void {
    this.events.push(ev);
  }

  private cancelAction(r: Roaster): void {
    r.channelKind = 0;
    r.channelTarget = -1;
    r.channelLeft = 0;
    r.dashLeft = 0;
  }

  stun(target: Roaster, seconds: number, by: number): boolean {
    if (this.isShielded(target)) {
      this.emit({ t: 'blocked', tick: this.tick, roaster: target.id, by });
      return false;
    }
    const applied = applyStunTimer(target, this.time, seconds);
    this.dropCarried(target, 'stun');
    this.cancelAction(target);
    target.vx = 0;
    target.vy = 0;
    refreshState(target, this.time);
    if (by >= 0 && by !== target.id) this.roasters[by]!.stuns++;
    this.emit({ t: 'stun', tick: this.tick, roaster: target.id, by, duration: applied });
    return true;
  }

  root(target: Roaster, seconds: number, by: number): boolean {
    if (this.isShielded(target)) {
      this.emit({ t: 'blocked', tick: this.tick, roaster: target.id, by });
      return false;
    }
    target.rootUntil = Math.max(target.rootUntil, this.time + seconds);
    target.dashLeft = 0;
    this.emit({ t: 'root', tick: this.tick, roaster: target.id, by, duration: seconds });
    return true;
  }

  knockback(target: Roaster, ix: number, iy: number, by: number): boolean {
    if (this.isShielded(target)) {
      this.emit({ t: 'blocked', tick: this.tick, roaster: target.id, by });
      return false;
    }
    target.kx += ix;
    target.ky += iy;
    this.dropCarried(target, 'knockback');
    this.cancelAction(target);
    return true;
  }

  dropCarried(r: Roaster, reason: DropReason): void {
    if (r.carried < 0) return;
    const c = this.chickens[r.carried]!;
    assert(c.state === 'carried' && c.carrier === r.id, `drop invariant: chicken ${c.id} not carried by roaster ${r.id}`);
    const a = this.rngAbility() * Math.PI * 2;
    c.state = 'free';
    c.carrier = -1;
    c.x = r.x;
    c.y = r.y;
    c.vx = Math.cos(a) * 3;
    c.vy = Math.sin(a) * 3;
    c.grabUntil = 0;
    r.carried = -1;
    refreshState(r, this.time);
    this.emit({ t: 'drop', tick: this.tick, roaster: r.id, chicken: c.id, x: c.x, y: c.y, reason });
  }

  grantShield(r: Roaster, seconds: number): void {
    r.shieldUntil = Math.max(r.shieldUntil, this.time + seconds);
    this.emit({ t: 'shield', tick: this.tick, roaster: r.id, duration: seconds });
  }

  lockCoop(coopId: number, seconds: number, by: number): void {
    const c = this.coops[coopId]!;
    c.lockUntil = Math.max(c.lockUntil, this.time + seconds);
    this.emit({ t: 'lock', tick: this.tick, coop: coopId, by, duration: seconds });
  }

  plantBomb(x: number, y: number, fuse: number, radius: number, stunSec: number, owner: number): void {
    for (let i = 0; i < this.bombs.length; i++) {
      const b = this.bombs[i]!;
      if (b.alive) continue;
      b.alive = true; b.x = x; b.y = y; b.owner = owner; b.detonateAt = this.time + fuse; b.radius = radius; b.stunSec = stunSec;
      this.emit({ t: 'bombPlanted', tick: this.tick, x, y, fuse, owner });
      return;
    }
  }

  spawnLure(x: number, y: number, seconds: number, owner: number): void {
    for (let i = 0; i < this.lures.length; i++) {
      const l = this.lures[i]!;
      if (l.alive) continue;
      l.alive = true; l.x = x; l.y = y; l.owner = owner; l.expiresAt = this.time + seconds;
      this.emit({ t: 'lure', tick: this.tick, id: l.id, x, y, owner, duration: seconds });
      return;
    }
  }

  // ------------------------------------------------------------ internals used by systems
  spawnChicken(x: number, y: number): Chicken | null {
    if (this.chickenCount >= this.chickens.length) return null;
    const c = this.chickens[this.chickenCount++]!;
    c.alive = true; c.state = 'free'; c.x = x; c.y = y; c.px = x; c.py = y; c.vx = 0; c.vy = 0;
    c.wanderX = x; c.wanderY = y; c.wanderUntil = 0; c.carrier = -1; c.pullTo = -1; c.pullUntil = 0; c.grabUntil = 0;
    this.emit({ t: 'spawn', tick: this.tick, chicken: c.id, x, y });
    return c;
  }

  scoreboard(): Score[] {
    const out: Score[] = [];
    for (let i = 0; i < this.coops.length; i++) {
      const c = this.coops[i]!;
      out.push({ slot: i, points: c.score, carried: this.roasters[i]!.carried >= 0 ? 1 : 0, lastScoreTick: c.lastScoreTick });
    }
    return out;
  }

  finish(winner: number, draw: boolean, overtime: boolean): void {
    this.phase = 'ended';
    this.winnerSlot = winner;
    this.draw = draw;
    this.overtime = overtime;
    this.emit({ t: 'end', tick: this.tick, winner, draw, overtime, scores: this.coops.map((c) => c.score) });
  }

  /** Full consistency check (tests call it every tick). Throws InvariantError. */
  verifyInvariants(): void {
    let stored = 0;
    let sum = 0;
    for (let i = 0; i < this.chickenCount; i++) {
      const c = this.chickens[i]!;
      if (c.state === 'carried') {
        assert(c.carrier >= 0 && this.roasters[c.carrier]!.carried === c.id, `carried chicken ${c.id} has no matching carrier`);
      } else assert(c.carrier === -1 || c.state === 'stored', `chicken ${c.id} has stale carrier`);
      if (c.state === 'stored') stored++;
    }
    for (const r of this.roasters) {
      if (r.carried >= 0) assert(this.chickens[r.carried]!.state === 'carried', `roaster ${r.id} carries a non-carried chicken`);
      assert(r.stunUntil - this.time <= 1.2 + 1e-9, `roaster ${r.id} stun exceeds max`);
    }
    for (const c of this.coops) sum += c.score;
    assert(sum === stored, `coop score sum ${sum} !== stored chickens ${stored}`);
    assert(sum >= this.lastScoreSum, 'coop points decreased (no ability may steal points)');
    this.lastScoreSum = sum;
  }

  result(): MatchResult {
    assert(this.phase === 'ended', 'result() requires an ended match');
    const scores = this.scoreboard();
    const catches = this.roasters.map((r) => r.catches);
    const stuns = this.roasters.map((r) => r.stuns);
    const top = (arr: readonly number[]): number => {
      let best = -1;
      let bv = 0;
      for (let i = 0; i < arr.length; i++) if (arr[i]! > bv) { bv = arr[i]!; best = i; }
      return best;
    };
    return {
      winnerSlot: this.winnerSlot, draw: this.draw, overtime: this.overtime, ticks: this.tick, scores, catches, stuns,
      highlights: { topCatcher: top(catches), mostStuns: top(stuns), biggestSwing: biggestSwing(this.events.history, this.coops.length) },
      eventHash: hashEvents(this.events.history),
    };
  }
}

/** Largest point gain by one coop inside any 3 s window. */
function biggestSwing(events: readonly SimEvent[], n: number): { slot: number; points: number } | null {
  const WINDOW = TICK_RATE * 3;
  const ticks: number[][] = Array.from({ length: n }, () => []);
  for (const ev of events) if (ev.t === 'deliver') ticks[ev.coop]!.push(ev.tick);
  let best: { slot: number; points: number } | null = null;
  for (let s = 0; s < n; s++) {
    const t = ticks[s]!;
    let lo = 0;
    for (let hi = 0; hi < t.length; hi++) {
      while (t[hi]! - t[lo]! >= WINDOW) lo++;
      const gain = hi - lo + 1;
      if (best === null || gain > best.points) best = { slot: s, points: gain };
    }
  }
  return best;
}
