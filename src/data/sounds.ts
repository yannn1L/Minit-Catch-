import { soundId, type SoundId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { ZzfxParams } from '../shared/types.ts';

// ZzFX parameter order: volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
// deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo
export const SFX_DEFS: readonly (readonly [string, ZzfxParams])[] = [
  // GDD catalog (verbatim)
  ['pickup', [null, null, 1200, null, 0.05, 0.05, 1, 2, null, null, null, null, null, 0.5]],
  ['deliver', [null, null, 600, null, 0.1, 0.1, 2, 1.5, null, null, null, null, null, 0.3]],
  ['bomb', [null, null, 80, 0.01, 0.3, 0.4, 1, 0.2, null, null, null, -0.3, 0.5]],
  ['stun', [null, null, 200, 0.05, 0.2, 0.3, 3, 0.5]],
  ['dash', [null, null, 900, 0.02, 0.1, 0.2, 1, 2, null, null, null, null, null, 0.4]],
  ['scoreUp', [null, null, 800, null, 0.08, 0.1, 1, 1.5, null, null, null, null, null, 0.4]],
  // Additions to reach the 12+ SFX target
  ['net', [0.8, 0.05, 400, 0.01, 0.08, 0.2, 4, 1, -2, null, null, null, null, 0.2]],
  ['slam', [1, 0.05, 60, 0.005, 0.1, 0.25, 4, 1.2, -1, null, null, null, null, 0.8]],
  ['magnet', [0.7, 0, 300, 0.1, 0.2, 0.2, 0, 1, 3, 0, null, null, 0.1, 0]],
  ['shield', [0.7, 0, 500, 0.02, 0.1, 0.3, 0, 1, 1, 0, 100, 0.05, null, 0]],
  ['lock', [0.8, 0.02, 150, 0, 0.05, 0.12, 2, 1, null, null, null, null, 0.06, 0.1]],
  ['lure', [0.6, 0.1, 1500, 0.01, 0.05, 0.1, 0, 1, -4, null, null, null, 0.04, 0]],
  ['drop', [0.7, 0.05, 250, 0, 0.03, 0.12, 2, 1, -3, null, null, null, null, 0]],
  ['blocked', [0.6, 0, 1800, 0, 0.02, 0.08, 3, 1, null, null, null, null, null, 0]],
  ['countdown', [0.8, 0, 440, 0.01, 0.05, 0.1, 0, 1]],
  ['go', [1, 0, 880, 0.01, 0.15, 0.2, 2, 1]],
  ['win', [1, 0, 523, 0.02, 0.3, 0.5, 2, 1, 0, 0, 200, 0.12, 0.2, 0]],
  ['ui', [0.5, 0, 700, 0, 0.02, 0.04, 1, 1]],
];

export function registerSounds(reg: Registry<SoundId, ZzfxParams>): void {
  for (const [name, params] of SFX_DEFS) reg.register(soundId(name), params);
}

// ---- BGM: 8-bar loop, bass + arp + perc, as ZzFX templates (frequency filled per note) ----
export const BGM = {
  bpm: 140,
  stepsPerBar: 16,
  bars: [
    { root: 45, minor: true }, { root: 41, minor: false }, { root: 48, minor: false }, { root: 43, minor: false },
    { root: 45, minor: true }, { root: 41, minor: false }, { root: 50, minor: true }, { root: 40, minor: false },
  ],
  /** semitone offsets from the bar root, null = rest */
  bass: [0, null, null, 0, null, null, 12, null, 0, null, null, 0, null, 7, null, null] as readonly (number | null)[],
  /** index into the chord tones stacked over two octaves */
  arp: [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 1] as readonly number[],
  kick: [0, 8, 10] as readonly number[],
  snare: [4, 12] as readonly number[],
  hat: [2, 6, 10, 14] as readonly number[],
  bassTemplate: [0.7, 0, 0, 0.01, 0.1, 0.08, 1, 1] as ZzfxParams,
  arpTemplate: [0.28, 0, 0, 0.005, 0.03, 0.07, 2, 1] as ZzfxParams,
  kickParams: [0.9, 0, 140, 0, 0.02, 0.12, 0, 1.5, -6] as ZzfxParams,
  snareParams: [0.45, 0, 300, 0, 0.02, 0.1, 4, 1, 0, 0, 0, 0, 0, 0.8] as ZzfxParams,
  hatParams: [0.2, 0, 4000, 0, 0, 0.03, 4, 1, 0, 0, 0, 0, 0, 1] as ZzfxParams,
};
