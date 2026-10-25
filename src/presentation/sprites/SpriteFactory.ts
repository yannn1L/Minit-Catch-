import { Rectangle, Texture } from 'pixi.js';
import type { SpriteId } from '../../core/ids.ts';
import type { Registry } from '../../core/Registry.ts';
import type { AnimName, SpriteDef } from '../../shared/types.ts';

const ATLAS_W = 512;

interface Placed { x: number; y: number }

/** Converts Frame[] + Palette into one nearest-filtered atlas (built once at LoadingScene) and caches textures. */
export class SpriteFactory {
  readonly atlas: Texture;
  private readonly cache = new Map<SpriteId, Partial<Record<AnimName, Texture[]>>>();
  private readonly sizes = new Map<SpriteId, { w: number; h: number }>();

  constructor(reg: Registry<SpriteId, SpriteDef>) {
    const defs = reg.all();
    // shelf packing with 1px gutters
    const placements: Placed[] = [];
    let x = 0, y = 0, rowH = 0;
    for (const d of defs) {
      for (const frames of Object.values(d.animations)) {
        for (let i = 0; i < frames.length; i++) {
          if (x + d.width + 1 > ATLAS_W) { x = 0; y += rowH + 1; rowH = 0; }
          placements.push({ x, y });
          x += d.width + 1;
          rowH = Math.max(rowH, d.height);
        }
      }
    }
    const height = y + rowH + 1;
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_W;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2D canvas unavailable');

    const frameRects: { def: SpriteDef; anim: AnimName; rect: Rectangle }[] = [];
    let pi = 0;
    for (const d of defs) {
      this.sizes.set(d.id, { w: d.width, h: d.height });
      for (const anim of Object.keys(d.animations) as AnimName[]) {
        for (const frame of d.animations[anim] ?? []) {
          const p = placements[pi++]!;
          const img = ctx.createImageData(d.width, d.height);
          for (let r = 0; r < d.height; r++) {
            const row = frame[r]!;
            for (let c = 0; c < d.width; c++) {
              const ch = row[c]!;
              if (ch === '.') continue;
              const argb = d.palette[ch]!;
              const o = (r * d.width + c) * 4;
              img.data[o] = (argb >>> 16) & 255;
              img.data[o + 1] = (argb >>> 8) & 255;
              img.data[o + 2] = argb & 255;
              img.data[o + 3] = (argb >>> 24) & 255;
            }
          }
          ctx.putImageData(img, p.x, p.y);
          frameRects.push({ def: d, anim, rect: new Rectangle(p.x, p.y, d.width, d.height) });
        }
      }
    }
    this.atlas = Texture.from(canvas);
    this.atlas.source.scaleMode = 'nearest';
    for (const fr of frameRects) {
      const entry = this.cache.get(fr.def.id) ?? {};
      (entry[fr.anim] ??= []).push(new Texture({ source: this.atlas.source, frame: fr.rect }));
      this.cache.set(fr.def.id, entry);
    }
  }

  frames(id: SpriteId, anim: AnimName = 'idle'): readonly Texture[] {
    const f = this.cache.get(id)?.[anim];
    if (f === undefined || f.length === 0) throw new Error(`[SpriteFactory] no frames for "${id}/${anim}"`);
    return f;
  }

  frame(id: SpriteId, anim: AnimName = 'idle', index = 0): Texture {
    const f = this.frames(id, anim);
    return f[index % f.length]!;
  }

  size(id: SpriteId): { w: number; h: number } {
    const s = this.sizes.get(id);
    if (s === undefined) throw new Error(`[SpriteFactory] unknown sprite "${id}"`);
    return s;
  }
}
