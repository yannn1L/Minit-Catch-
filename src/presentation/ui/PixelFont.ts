import { Container, Rectangle, Sprite, Texture } from 'pixi.js';

// 3x5 bitmap font generated from code (zero-asset). '#' = pixel. Lowercase maps to uppercase.
const G: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'], '.': ['...', '...', '...', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['##.', '..#', '.#.', '...', '.#.'], '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  ',': ['...', '...', '...', '.#.', '#..'], "'": ['.#.', '.#.', '...', '...', '...'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '[': ['###', '#..', '#..', '#..', '###'], ']': ['###', '..#', '..#', '..#', '###'],
  '|': ['.#.', '.#.', '.#.', '.#.', '.#.'], '"': ['#.#', '#.#', '...', '...', '...'], ';': ['...', '.#.', '...', '.#.', '#..'],
  '=': ['...', '###', '...', '###', '...'], '#': ['#.#', '###', '#.#', '###', '#.#'], '*': ['...', '#.#', '.#.', '#.#', '...'],
  '_': ['...', '...', '...', '...', '###'],
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;
export const ADVANCE = 4;
export const LINE = 6;

/** White glyph atlas on one canvas; PixelText tints sprites. Textures use nearest sampling. */
export class PixelFont {
  private readonly glyphs = new Map<string, Texture>();
  private readonly fallback: Texture;

  constructor() {
    const keys = Object.keys(G);
    const canvas = document.createElement('canvas');
    canvas.width = keys.length * ADVANCE;
    canvas.height = GLYPH_H;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('2D canvas unavailable');
    ctx.fillStyle = '#fff';
    keys.forEach((k, i) => {
      G[k]!.forEach((row, y) => {
        for (let x = 0; x < GLYPH_W; x++) if (row[x] === '#') ctx.fillRect(i * ADVANCE + x, y, 1, 1);
      });
    });
    const atlas = Texture.from(canvas);
    atlas.source.scaleMode = 'nearest';
    keys.forEach((k, i) => this.glyphs.set(k, new Texture({ source: atlas.source, frame: new Rectangle(i * ADVANCE, 0, GLYPH_W, GLYPH_H) })));
    this.fallback = this.glyphs.get('?')!;
  }

  glyph(ch: string): Texture {
    return this.glyphs.get(ch.toUpperCase()) ?? this.fallback;
  }
}

export type Align = 'left' | 'center' | 'right';

/** Sprite-per-glyph text with a reusable sprite pool; setText() is a no-op when unchanged. */
export class PixelText extends Container {
  private readonly font: PixelFont;
  private readonly pool: Sprite[] = [];
  private value = '';
  private color: number;
  private readonly align: Align;
  textWidth = 0;

  constructor(font: PixelFont, text = '', color = 0xffffff, align: Align = 'left') {
    super();
    this.font = font;
    this.color = color;
    this.align = align;
    this.setText(text);
  }

  get text(): string {
    return this.value;
  }

  setTint(color: number): void {
    if (color === this.color) return;
    this.color = color;
    for (const s of this.pool) s.tint = color;
  }

  setText(text: string): void {
    if (text === this.value && this.pool.length > 0) return;
    this.value = text;
    let x = 0;
    let y = 0;
    let used = 0;
    let maxX = 0;
    for (const ch of text) {
      if (ch === '\n') { maxX = Math.max(maxX, x - 1); x = 0; y += LINE; continue; }
      let s = this.pool[used];
      if (s === undefined) {
        s = new Sprite(this.font.glyph(ch));
        s.tint = this.color;
        this.pool.push(s);
        this.addChild(s);
      } else s.texture = this.font.glyph(ch);
      s.visible = ch !== ' ';
      s.position.set(x, y);
      x += ADVANCE;
      used++;
    }
    for (let i = used; i < this.pool.length; i++) this.pool[i]!.visible = false;
    this.textWidth = Math.max(maxX, x - 1, 0);
    const shift = this.align === 'center' ? -Math.floor(this.textWidth / 2) : this.align === 'right' ? -this.textWidth : 0;
    this.pivot.x = -shift;
  }
}
