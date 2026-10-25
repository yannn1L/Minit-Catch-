import { Texture } from 'pixi.js';
import { SLOT_COLORS } from '../../data/palette.ts';
import type { ArenaLayoutResult } from '../../domain/strategies/arena.ts';

export const PPM = 16; // pixels per meter at zoom 1
const MARGIN_M = 2;

export interface Ground {
  readonly texture: Texture;
  /** world-pixel offset of the texture's top-left corner */
  readonly originPx: number;
}

const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Renders the static arena (floor, fence, pads, pillars) pixel-by-pixel into one nearest-sampled texture. */
export function buildGround(a: ArenaLayoutResult): Ground {
  const half = a.radius + MARGIN_M;
  const size = Math.ceil(half * 2 * PPM);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D canvas unavailable');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const grassA = rgb(0x4f8f4a), grassB = rgb(0x468543), fence = rgb(0x6b4a2f), fenceHi = rgb(0x8a6340), dirt = rgb(0x3a2f27);
  const pillar = rgb(0x7d8597), pillarHi = rgb(0xa5adbd);
  const pads = a.coops.map((c, i) => ({ c, col: rgb(SLOT_COLORS[i % SLOT_COLORS.length]!) }));
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const wx = (px + 0.5) / PPM - half;
      const wy = (py + 0.5) / PPM - half;
      const dist = Math.hypot(wx, wy);
      let col: [number, number, number] | null = null;
      if (dist > a.radius + 0.5) col = null;
      else if (dist > a.radius - 0.25) col = dist > a.radius ? dirt : fenceHi;
      else if (dist > a.radius - 0.5) col = fence;
      else {
        col = ((px >> 4) + (py >> 4)) & 1 ? grassA : grassB;
        for (const p of pads) {
          const pd = Math.hypot(wx - p.c.x, wy - p.c.y);
          if (pd < 2.1 && pd > 1.85) col = p.col;
          else if (pd <= 1.85) col = [(col[0] * 2 + p.col[0]) / 3, (col[1] * 2 + p.col[1]) / 3, (col[2] * 2 + p.col[2]) / 3];
        }
        for (const o of a.obstacles) {
          const od = Math.hypot(wx - o.x, wy - o.y);
          if (od < o.r) col = od > o.r - 0.14 || wy < o.y - o.r * 0.45 ? pillarHi : pillar;
        }
      }
      if (col !== null) {
        const i = (py * size + px) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  return { texture, originPx: -half * PPM };
}

/** Small top-down preview for the editor (1 px per ~0.5 m). */
export function buildPreview(a: ArenaLayoutResult, px: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D canvas unavailable');
  const k = (px / 2 - 1) / a.radius;
  const c = px / 2;
  const dot = (x: number, y: number, r: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(c + x * k - r / 2), Math.round(c + y * k - r / 2), r, r);
  };
  ctx.fillStyle = '#2d5a2b';
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) if (Math.hypot(x - c + 0.5, y - c + 0.5) <= px / 2 - 1) ctx.fillRect(x, y, 1, 1);
  for (const o of a.obstacles) dot(o.x, o.y, Math.max(2, Math.round(o.r * k * 2)), '#9aa3b5');
  for (const s of a.spawnPoints) dot(s.x, s.y, 1, '#ffd23f');
  a.coops.forEach((co, i) => dot(co.x, co.y, 3, '#' + SLOT_COLORS[i % SLOT_COLORS.length]!.toString(16).padStart(6, '0')));
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}
