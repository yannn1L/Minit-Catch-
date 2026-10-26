/** 0xRRGGBB -> opaque 0xAARRGGBB */
export const argb = (rgb: number, a = 0xff): number => ((a << 24) | rgb) >>> 0;

/** One distinct color per participant slot (coop, ring, HUD swatch) up to 20 participants. */
export const SLOT_COLORS: readonly number[] = [
  0xe63946, 0x3a86ff, 0x2ec4b6, 0xffbe0b, 0x9d4edd, 0xfb5607,
  0x80ed99, 0xf72585, 0x4cc9f0, 0xc9ada7, 0xffffff, 0x8d99ae,
  0xff70a6, 0x70d6ff, 0xff9770, 0xffd670, 0xe9ff70, 0x06d6a0,
  0x118ab2, 0xd90429,
];

export const TEAM_COLORS = {
  red: 0xef233c,
  blue: 0x0096c7,
  redLight: 0xff6b6b,
  blueLight: 0x48cae4,
} as const;

export const UI = {
  bg: 0x10131c,
  panel: 0x1b2030,
  panelHi: 0x2a3250,
  border: 0x4a5578,
  text: 0xe9edf7,
  dim: 0x8c96b3,
  accent: 0xffd23f,
  good: 0x6ee7a0,
  bad: 0xff6b6b,
} as const;
