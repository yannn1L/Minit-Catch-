import { spriteId } from '../../core/ids.ts';
import type { Frame, SpriteDef } from '../../shared/types.ts';
import { argb } from '../palette.ts';
import { ROASTER_DEFS } from '../roasters.ts';

// Roaster art: 12x13 px, facing right (renderer mirrors for left). Frames are assembled from
// body rows + leg rows so every frame is a plain `readonly string[]` (GDD frameFormat).
const W = 12;
const BODY: readonly string[] = [
  '....AA......',
  '...AAAA.....',
  '..oPPPPo....',
  '..oPkPPoyy..',
  '..oPPPPoy...',
  '...oPPo.....',
  '.oPPPPPPo...',
  'oPPPAAPPPo..',
  'oPPPAAPPPo..',
  '.oPPPPPPo...',
];
const CARRY_ROWS: readonly string[] = ['oPPPPPPPPo..', 'oPPPAAPPPPo.', '.oPPAAPPo...'];
const BLANK = '.'.repeat(W);
const STAND = ['..oo..oo....', '..yy..yy....', '..yyy.yyy...'];
const RUN: readonly (readonly string[])[] = [
  ['..oo..oo....', '..yy...yy...', '..yy....yy..'],
  ['...oo.oo....', '...yy.yy....', '...yyyyy....'],
  ['..oo..oo....', '...yy.yy....', '..yy...yy...'],
  ['....oooo....', '....yyyy....', '...yy..yy...'],
];

/** Per-roaster headgear rows (rows 0-1). 'H' hat (accent), 'h' dark hat, 'r' red. Max 8 palette colors. */
const HEADS: Readonly<Record<string, readonly [string, string]>> = {
  boomer: ['....r.......', '...hhhh.....'],
  netta: ['..H.H.H.H...', '...HHHHH....'],
  dash: ['............', '..HHHHHH....'],
  magna: ['..r....r....', '..rrhhrr....'],
  guard: ['...HHHH.....', '..HHHHHH....'],
  trix: ['..H..HH..H..', '...HHHHHH...'],
  sabo: ['............', '...hhhhh....'],
  tank: ['....AA......', '...AAAA.....'],
};

function compose(body: readonly string[], legs: readonly string[], bob: boolean): Frame {
  return bob ? [BLANK, ...body, ...legs.slice(1)] : [...body, ...legs];
}

function withHead(body: readonly string[], head: readonly [string, string], row0?: string): string[] {
  const out = [...body];
  out[0] = row0 ?? head[0];
  out[1] = head[1];
  return out;
}

export function makeRoasterSprites(): SpriteDef[] {
  return ROASTER_DEFS.map((def) => {
    const head = HEADS[def.id] ?? HEADS['tank']!;
    const base = withHead(BODY, head);
    const carry = [...base.slice(0, 6), ...CARRY_ROWS, base[9]!];
    const stunA = withHead(BODY, head, '..y.....y...');
    const stunB = withHead(BODY, head, '....y..y....');
    stunA[3] = '..oPkkPoyy..';
    stunB[3] = '..oPkkPoyy..';
    return {
      id: spriteId(`roaster_${def.id}`),
      width: W,
      height: 13,
      palette: {
        o: argb(0x1d1b2b), P: argb(def.colors.primary), A: argb(def.colors.accent), k: argb(0x0b0b10),
        y: argb(0xffb703), r: argb(0xe63946), H: argb(def.colors.accent), h: argb(0x23232e),
      },
      animations: {
        idle: [compose(base, STAND, false), compose(base, STAND, true)],
        run: RUN.map((legs, i) => compose(base, legs, i % 2 === 1)),
        carry: [compose(carry, STAND, false), compose(carry, STAND, true)],
        stun: [compose(stunA, STAND, false), compose(stunB, STAND, true)],
      },
    };
  });
}
