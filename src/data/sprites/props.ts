import { spriteId } from '../../core/ids.ts';
import type { Frame, SpriteDef } from '../../shared/types.ts';
import { SLOT_COLORS, argb } from '../palette.ts';

const one = (id: string, palette: Record<string, number>, rows: readonly string[]): SpriteDef => ({
  id: spriteId(id), width: rows[0]!.length, height: rows.length, palette, animations: { idle: [rows] },
});

const CHICKEN_PALETTE = { w: argb(0xf7f3e8), o: argb(0x3a3a4a), r: argb(0xe03b3b), y: argb(0xffb400), k: argb(0x111111) };
const CHICKEN_BODY: readonly string[] = [
  '...r....',
  '..owwy..',
  '..owko..',
  '.owwwwo.',
  'owwwwwwo',
  'owwwwwwo',
  '.owwwwo.',
  '..y..y..',
];
const withLegs = (legs: string, mod?: (rows: string[]) => void): Frame => {
  const rows = [...CHICKEN_BODY.slice(0, 7), legs];
  mod?.(rows);
  return rows;
};

export const CHICKEN_SPRITE: SpriteDef = {
  id: spriteId('chicken'), width: 8, height: 8, palette: CHICKEN_PALETTE,
  animations: {
    idle: [withLegs('..y..y..'), withLegs('.yy..yy.', (r) => { r[2] = '..owwo..'; })],
    run: [withLegs('..y..yy.'), withLegs('.y..y...'), withLegs('..yyy...'), withLegs('.y...y..')],
    carry: [withLegs('..y..y..', (r) => { r[4] = 'wwwwwwww'; }), withLegs('..y..y..', (r) => { r[3] = 'w.wwww.w'; })],
  },
};

/** Coop: 22x16 hut; 'S' roof uses the slot color. */
function coopRows(): string[] {
  const rows: string[] = [];
  const roof = (w: number, pad: number): string => '.'.repeat(pad) + 'S'.repeat(w) + '.'.repeat(pad);
  rows.push(roof(6, 8), roof(10, 6), roof(14, 4), roof(18, 2), roof(20, 1));
  rows.push('.' + 'b'.repeat(20) + '.');
  for (let i = 0; i < 6; i++) {
    const mid = i >= 2 ? 'dddd' : 'wwww';
    rows.push('.b' + 'w'.repeat(7) + mid + 'w'.repeat(7) + 'b.');
  }
  rows.push('.' + 'b'.repeat(20) + '.');
  rows.push('.'.repeat(2) + 'g'.repeat(18) + '.'.repeat(2));
  rows.push('.'.repeat(22).slice(0, 22));
  return rows.slice(0, 16).map((r) => r.padEnd(22, '.').slice(0, 22));
}

export function makeCoopSprites(): SpriteDef[] {
  const rows = coopRows();
  return SLOT_COLORS.map((c, i) => ({
    id: spriteId(`coop_${i}`), width: 22, height: rows.length,
    palette: { S: argb(c), b: argb(0x5b3a29), w: argb(0xc99a62), d: argb(0x2a1a12), g: argb(0x2f5d3a) },
    animations: { idle: [rows] },
  }));
}

export const PROP_SPRITES: readonly SpriteDef[] = [
  one('ring', { w: argb(0xffffff) }, ['..wwwwww..', '.w......w.', 'w........w', '.w......w.', '..wwwwww..']),
  one('bomb', { o: argb(0x15151c), g: argb(0x4a4a5c), y: argb(0xffd23f), r: argb(0xff5d3a) }, [
    '....yr.', '...o...', '..ooo..', '.oggoo.', '.ogooo.', '.ooooo.', '..ooo..',
  ]),
  one('star', { w: argb(0xffffff) }, ['.w.', 'www', '.w.']),
  one('puff', { w: argb(0xffffff) }, ['.www.', 'wwwww', 'wwwww', 'wwwww', '.www.']),
  one('crown', { y: argb(0xffd23f), o: argb(0xb8860b) }, ['y.y.y', 'yyyyy', 'ooooo']),
  one('bubble', { w: argb(0xbfe9ff) }, [
    '...wwwwww...', '..w......w..', '.w........w.', 'w..........w', 'w..........w', 'w..........w',
    'w..........w', '.w........w.', '..w......w..', '...wwwwww...',
  ]),
  one('lock', { o: argb(0x1b1b24), y: argb(0xffd23f) }, ['.ooo.', 'o...o', 'yyyyy', 'yyoyy', 'yyyyy']),
  one('arrow', { w: argb(0xffffff) }, ['..w..', '.www.', 'wwwww']),
];
