import type { AbilityId, ArenaId, RoasterId, SpriteId } from '../core/ids.ts';

export interface Vec2 {
  x: number;
  y: number;
}

/** ZzFX positional parameter array; `null` = use the ZzFX default. */
export type ZzfxParams = readonly (number | null)[];

// ---------------------------------------------------------------- art
export type AnimName = 'idle' | 'run' | 'carry' | 'stun';
export type Frame = readonly string[];
/** char -> 0xAARRGGBB */
export type Palette = Readonly<Record<string, number>>;

export interface SpriteDef {
  readonly id: SpriteId;
  readonly width: number;
  readonly height: number;
  readonly palette: Palette;
  readonly animations: Readonly<Partial<Record<AnimName, readonly Frame[]>>>;
}

// ---------------------------------------------------------------- data
export interface RoasterStats {
  readonly moveSpeed: number; // m/s
  readonly pickupRadius: number; // m
  readonly carrySlots: 1;
  readonly mass: number;
}

export interface RoasterDef {
  readonly id: RoasterId;
  readonly name: string;
  readonly ability: AbilityId;
  readonly stats: RoasterStats;
  readonly sprite: SpriteId;
  readonly colors: { readonly primary: number; readonly accent: number };
  readonly role?: string;
  readonly description?: string;
}

export interface ChickenSpawnConfig {
  initial: number;
  cap: number; // max chickens on the field (free + carried)
  interval: number; // seconds between spawns
}

export interface ObserverConfig {
  cameraDirector: boolean;
  speed: number;
  zoom?: number; // 0 = Auto, 1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x
  hideControls?: boolean;
  hideHints?: boolean;
  randomArena?: boolean;
  randomSeed?: boolean;
}

export type MatchMode = 'ffa' | 'tag_team';

export interface MatchConfig {
  seed: number; // 32-bit, non-zero
  participants: number;
  roasterIds: RoasterId[];
  arenaId: ArenaId;
  durationSec: number;
  chickenSpawn: ChickenSpawnConfig;
  observer: ObserverConfig;
  mode?: MatchMode;
  teamSize?: number; // 2..10 for tag_team
}

// ---------------------------------------------------------------- scoring
export interface Score {
  readonly slot: number;
  readonly points: number;
  readonly carried: number; // chickens currently carried (0|1)
  readonly lastScoreTick: number; // tick of most recent deposit (Infinity when none)
}

export interface MatchResult {
  readonly winnerSlot: number;
  readonly draw: boolean;
  readonly overtime: boolean;
  readonly ticks: number;
  readonly scores: readonly Score[];
  readonly catches: readonly number[];
  readonly stuns: readonly number[];
  readonly highlights: {
    readonly topCatcher: number; // slot or -1
    readonly mostStuns: number; // slot or -1
    readonly biggestSwing: { readonly slot: number; readonly points: number } | null;
  };
  readonly eventHash: string;
  readonly mode?: MatchMode;
  readonly winningTeam?: 0 | 1 | -1;
  readonly teamScores?: readonly [number, number];
}

// ---------------------------------------------------------------- events (ground truth for replay/tests)
export type DropReason = 'stun' | 'knockback';

export type SimEvent =
  | { t: 'start'; tick: number; participants: number }
  | { t: 'spawn'; tick: number; chicken: number; x: number; y: number }
  | { t: 'pickup'; tick: number; roaster: number; chicken: number }
  | { t: 'drop'; tick: number; roaster: number; chicken: number; x: number; y: number; reason: DropReason }
  | { t: 'deliver'; tick: number; roaster: number; chicken: number; coop: number; score: number }
  | { t: 'ability'; tick: number; roaster: number; ability: AbilityId; x: number; y: number; dx: number; dy: number; hits: number }
  | { t: 'stun'; tick: number; roaster: number; by: number; duration: number }
  | { t: 'root'; tick: number; roaster: number; by: number; duration: number }
  | { t: 'shield'; tick: number; roaster: number; duration: number }
  | { t: 'blocked'; tick: number; roaster: number; by: number }
  | { t: 'bombPlanted'; tick: number; x: number; y: number; fuse: number; owner: number }
  | { t: 'bomb'; tick: number; x: number; y: number; radius: number; owner: number; hits: number }
  | { t: 'lock'; tick: number; coop: number; by: number; duration: number }
  | { t: 'lure'; tick: number; id: number; x: number; y: number; owner: number; duration: number }
  | { t: 'lureEnd'; tick: number; id: number; x: number; y: number; consumedBy: number }
  | { t: 'overtime'; tick: number }
  | { t: 'end'; tick: number; winner: number; draw: boolean; overtime: boolean; scores: readonly number[] };

export type SimEventType = SimEvent['t'];
