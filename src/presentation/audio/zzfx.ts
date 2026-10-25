import type { ZzfxParams } from '../../shared/types.ts';

export const ZZFX_SAMPLE_RATE = 44100;
const MASTER = 0.3;

/** TypeScript port of ZzFX's sample generator (positional params; null/undefined => default). */
export function buildSamples(p: ZzfxParams, rand: () => number = Math.random): Float32Array {
  const v = (i: number, d: number): number => {
    const x = p[i];
    return x === null || x === undefined ? d : x;
  };
  const volume = v(0, 1), randomness = v(1, 0.05);
  let frequency = v(2, 220);
  const shape = v(6, 0), shapeCurve = v(7, 1);
  let slide = v(8, 0), deltaSlide = v(9, 0), pitchJump = v(10, 0);
  const noise = v(13, 0);
  let modulation = v(14, 0);
  const bitCrush = v(15, 0), sustainVolume = v(17, 1), tremolo = v(19, 0);
  const SR = ZZFX_SAMPLE_RATE, PI2 = Math.PI * 2;
  const sign = (x: number): number => (x > 0 ? 1 : -1);

  slide *= (500 * PI2) / SR / SR;
  const startSlide = slide;
  frequency *= ((1 + randomness * 2 * rand() - randomness) * PI2) / SR;
  let startFrequency = frequency;
  const attack = v(3, 0) * SR + 9; // +9: minimum attack to avoid a click
  const decay = v(18, 0) * SR;
  const sustain = v(4, 0) * SR;
  const release = v(5, 0.1) * SR;
  const delay = v(16, 0) * SR;
  deltaSlide *= (500 * PI2) / SR ** 3;
  modulation *= PI2 / SR;
  pitchJump *= PI2 / SR;
  const pitchJumpTime = v(11, 0) * SR;
  const repeatTime = (v(12, 0) * SR) | 0;

  const length = (attack + decay + sustain + release + delay) | 0;
  const b = new Float32Array(length);
  let t = 0, tm = 0, j = 1, r = 0, c = 0, s = 0;

  for (let i = 0; i < length; i++) {
    if (!(++c % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin((t % PI2) ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - ((((2 * t) / PI2) % 2) + 2) % 2
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      s =
        (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) *
        sign(s) * Math.abs(s) ** shapeCurve * volume * MASTER *
        (i < attack ? i / attack
          : i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
          : i < attack + decay + sustain ? sustainVolume
          : i < length - delay ? ((length - i - delay) / release) * sustainVolume
          : 0);
      s = delay
        ? s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * (b[(i - delay) | 0] ?? 0)) / 2 / volume)
        : s;
    }
    const f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - ((Math.sin(i) + 1) * 1e9) % 2);
    if (j && ++j > pitchJumpTime) {
      frequency += pitchJump;
      startFrequency += pitchJump;
      j = 0;
    }
    if (repeatTime && !(++r % repeatTime)) {
      frequency = startFrequency;
      slide = startSlide;
      j = j || 1;
    }
    b[i] = s;
  }
  return b;
}
