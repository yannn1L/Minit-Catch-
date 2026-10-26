import { soundId, type SoundId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { ZzfxParams } from '../shared/types.ts';

// ZzFX parameter order: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
// deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo
export const SFX_DEFS: readonly (readonly [string, ZzfxParams])[] = [
  // Juicy & satisfying cartoon sound effects
  // 1. Pickup: Bouncy, cheerful bubble squish pop (rising sine chirp with rubbery snap)
  ['pickup', [0.85, 0.02, 720, 0.008, 0.04, 0.08, 0, 1.6, 6, 0, 180, 0.02, null, 0, 0, 0, 0, 1, 0.02]],
  // 2. Deliver: Sparkling, triumphant 3-tone cheerful chord chime (ringing bell warmth)
  ['deliver', [0.95, 0, 880, 0.01, 0.12, 0.28, 2, 1.2, 0, 0, 440, 0.05, 0.05, 0, 0, 0, 0.05, 1, 0.05]],
  // 3. Bomb: Rich cartoon boom with deep sub-bass thump and rumble (no harsh static)
  ['bomb', [1.0, 0.03, 85, 0.008, 0.25, 0.42, 1, 0.6, -2.5, 0, null, null, null, 0.32, 0, 0.1, 0.04]],
  // 4. Stun: Comical dizzy cartoon bird wobble / squishy tremolo
  ['stun', [0.75, 0.02, 420, 0.02, 0.18, 0.28, 3, 0.8, -0.8, 0, 0, 0, 0, 0, 18, 0, 0.02, 1, 0.08, 0.6]],
  // 5. Dash: Crisp aerodynamic whoosh sweep
  ['dash', [0.8, 0.02, 950, 0.008, 0.06, 0.16, 1, 1.8, -4, 0, null, null, null, 0.18]],
  // 6. ScoreUp: Crystal-clear arcade chime
  ['scoreUp', [0.85, 0, 1046, 0.005, 0.07, 0.15, 0, 1.4, 0, 0, 260, 0.03, null, 0]],
  // 7. Net: Cartoon springy twang catch
  ['net', [0.85, 0.03, 360, 0.008, 0.09, 0.22, 2, 1.2, -3, 0, 120, 0.04, null, 0.12, 8]],
  // 8. Slam: Punchy cartoon mallet ground thud with solid bass body
  ['slam', [1.0, 0.04, 75, 0.005, 0.14, 0.28, 0, 1.8, -2, 0, null, null, null, 0.24]],
  // 9. Magnet: Playful sci-fi tractor pull sweep
  ['magnet', [0.75, 0, 460, 0.04, 0.18, 0.22, 1, 1, 3.2, 0, null, null, 0.08, 0, 14]],
  // 10. Shield: Cheerful glassy crystal aura shimmer
  ['shield', [0.75, 0, 720, 0.01, 0.14, 0.32, 0, 1.1, 1.2, 0, 320, 0.04, null, 0, 6]],
  // 11. Lock: Crisp mechanical double-click snap
  ['lock', [0.8, 0.01, 280, 0, 0.04, 0.1, 2, 1.1, -1, 0, null, null, 0.04, 0.05]],
  // 12. Lure: Cheerful cartoon cluck chirp
  ['lure', [0.7, 0.05, 1200, 0.008, 0.04, 0.09, 1, 1.4, 3.5, 0, -350, 0.02, 0.03, 0]],
  // 13. Drop: Rubbery squishy cartoon plop
  ['drop', [0.75, 0.02, 380, 0.008, 0.04, 0.14, 0, 1.6, -7, 0, null, null, null, 0]],
  // 14. Blocked: Pleasant cartoon clink bounce
  ['blocked', [0.65, 0, 1500, 0, 0.02, 0.08, 3, 1.2, 1, 0, null, null, null, 0]],
  // 15. Countdown: Crisp resonant bell tick
  ['countdown', [0.8, 0, 587, 0.005, 0.05, 0.12, 0, 1.2]],
  // 16. Go: Triumphant dual fanfare ping
  ['go', [1.0, 0, 880, 0.008, 0.14, 0.25, 2, 1.2, 0, 0, 440, 0.04]],
  // 17. Win: Joyous celebratory victory melody
  ['win', [1.0, 0, 523, 0.01, 0.24, 0.45, 0, 1.2, 0, 0, 262, 0.08, 0.09, 0]],
  // 18. UI: Crisp tactile micro-tap
  ['ui', [0.5, 0, 850, 0, 0.015, 0.035, 0, 1.2]],
];

export function registerSounds(reg: Registry<SoundId, ZzfxParams>): void {
  for (const [name, params] of SFX_DEFS) reg.register(soundId(name), params);
}

export interface BgmDefinition {
  readonly bpm: number;
  readonly stepsPerBar: number;
  readonly bars: readonly { readonly root: number; readonly minor: boolean }[];
  readonly bass: readonly (number | null)[];
  readonly arp: readonly number[];
  readonly kick: readonly number[];
  readonly snare: readonly number[];
  readonly hat: readonly number[];
  readonly bassTemplate: ZzfxParams;
  readonly arpTemplate: ZzfxParams;
  readonly kickParams: ZzfxParams;
  readonly snareParams: ZzfxParams;
  readonly hatParams: ZzfxParams;
}

// ---- BGM 1: Editor Lounge / Menu (Groovy, chill, playful 8-bar loop) ----
export const BGM_EDITOR: BgmDefinition = {
  bpm: 136,
  stepsPerBar: 16,
  bars: [
    { root: 45, minor: true }, { root: 41, minor: false }, { root: 48, minor: false }, { root: 43, minor: false },
    { root: 45, minor: true }, { root: 41, minor: false }, { root: 50, minor: true }, { root: 40, minor: false },
  ],
  bass: [0, null, null, 0, null, null, 12, null, 0, null, null, 0, null, 7, null, null],
  arp: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 1],
  kick: [0, 8, 10],
  snare: [4, 12],
  hat: [2, 6, 10, 14],
  bassTemplate: [0.7, 0, 0, 0.01, 0.1, 0.08, 1, 1],
  arpTemplate: [0.26, 0, 0, 0.005, 0.03, 0.07, 2, 1],
  kickParams: [0.85, 0, 140, 0, 0.02, 0.12, 0, 1.5, -6],
  snareParams: [0.4, 0, 300, 0, 0.02, 0.1, 4, 1, 0, 0, 0, 0, 0, 0.8],
  hatParams: [0.18, 0, 4000, 0, 0, 0.03, 4, 1, 0, 0, 0, 0, 0, 1],
};

// ---- BGM 2: Simulation Battle (Fast energetic 8-bit arcade battle theme @ 152 BPM) ----
export const BGM_SIM: BgmDefinition = {
  bpm: 152,
  stepsPerBar: 16,
  bars: [
    { root: 50, minor: true },  // D min
    { root: 46, minor: false }, // Bb maj
    { root: 48, minor: false }, // C maj
    { root: 45, minor: true },  // A min
    { root: 50, minor: true },  // D min
    { root: 43, minor: true },  // G min
    { root: 45, minor: false }, // A maj (turnaround tension)
    { root: 50, minor: true },  // D min resolve
  ],
  // Driving 16th-note rhythmic bassline
  bass: [0, null, 0, null, 0, 0, null, 0, null, 0, 12, null, 0, null, 7, null],
  // High-energy syncopated battle arpeggio/lead line
  arp: [0, 2, 4, 2, 5, 4, 2, 4, 3, 5, 7, 5, 4, 3, 2, 1],
  // 4-on-the-floor driving kick for intense match momentum
  kick: [0, 4, 8, 12],
  // Snappy backbeat snare
  snare: [4, 12],
  // Fast 16th-note hi-hat sizzle
  hat: [1, 2, 6, 9, 10, 14],
  bassTemplate: [0.75, 0, 0, 0.008, 0.08, 0.06, 1, 1],
  arpTemplate: [0.32, 0, 0, 0.003, 0.04, 0.06, 2, 1.2],
  kickParams: [0.95, 0, 150, 0, 0.02, 0.11, 0, 1.6, -7],
  snareParams: [0.48, 0, 320, 0, 0.015, 0.09, 4, 1, 0, 0, 0, 0, 0, 0.85],
  hatParams: [0.22, 0, 4500, 0, 0, 0.025, 4, 1, 0, 0, 0, 0, 0, 1],
};

// Backwards compatibility alias
export const BGM = BGM_EDITOR;
