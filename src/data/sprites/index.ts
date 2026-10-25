import type { Registry } from '../../core/Registry.ts';
import type { SpriteId } from '../../core/ids.ts';
import type { SpriteDef } from '../../shared/types.ts';
import { CHICKEN_SPRITE, PROP_SPRITES, makeCoopSprites } from './props.ts';
import { makeRoasterSprites } from './roasters.ts';

export function allSprites(): SpriteDef[] {
  return [...makeRoasterSprites(), CHICKEN_SPRITE, ...makeCoopSprites(), ...PROP_SPRITES];
}

const MAX_COLORS = 8; // GDD performance.maxColorsPerSprite

/** Validates the frame grid and palette; throws a precise message (fail-fast at load). */
export function validateSprite(def: SpriteDef): void {
  if (Object.keys(def.palette).length > MAX_COLORS) throw new Error(`sprite ${def.id}: more than ${MAX_COLORS} colors`);
  for (const [anim, frames] of Object.entries(def.animations)) {
    frames.forEach((frame, fi) => {
      if (frame.length !== def.height) throw new Error(`sprite ${def.id}/${anim}[${fi}]: expected ${def.height} rows, got ${frame.length}`);
      frame.forEach((row, ri) => {
        if (row.length !== def.width) throw new Error(`sprite ${def.id}/${anim}[${fi}] row ${ri}: width ${row.length} != ${def.width}`);
        for (const ch of row) {
          if (ch !== '.' && def.palette[ch] === undefined) throw new Error(`sprite ${def.id}/${anim}[${fi}] row ${ri}: char "${ch}" not in palette`);
        }
      });
    });
  }
}

export function registerSprites(reg: Registry<SpriteId, SpriteDef>): void {
  for (const d of allSprites()) {
    validateSprite(d);
    reg.register(d.id, d);
  }
}
