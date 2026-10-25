import { Container, Rectangle, Sprite, Texture, type FederatedPointerEvent } from 'pixi.js';
import { UI } from '../../data/palette.ts';
import { PixelText, type PixelFont } from './PixelFont.ts';

export function rect(color: number, w: number, h: number, x = 0, y = 0, alpha = 1): Sprite {
  const s = new Sprite(Texture.WHITE);
  s.tint = color;
  s.width = w;
  s.height = h;
  s.position.set(x, y);
  s.alpha = alpha;
  return s;
}

export function label(font: PixelFont, text: string, x: number, y: number, color: number = UI.text, align: 'left' | 'center' | 'right' = 'left'): PixelText {
  const t = new PixelText(font, text, color, align);
  t.position.set(x, y);
  return t;
}

/** Pixel button: border + fill + centered label. Fires on pointertap. */
export class Button extends Container {
  readonly text: PixelText;
  private readonly fill: Sprite;
  private selected = false;
  private readonly bw: number;

  constructor(font: PixelFont, caption: string, x: number, y: number, w: number, h: number, onTap: () => void) {
    super();
    this.bw = w;
    this.position.set(x, y);
    this.addChild(rect(UI.border, w, h));
    this.fill = rect(UI.panel, w - 2, h - 2, 1, 1);
    this.addChild(this.fill);
    this.text = new PixelText(font, caption, UI.text, 'center');
    this.text.position.set(Math.floor(w / 2), Math.floor((h - 5) / 2));
    this.addChild(this.text);
    this.hitArea = new Rectangle(0, 0, w, h);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointertap', onTap);
    this.on('pointerover', () => this.paint(true));
    this.on('pointerout', () => this.paint(false));
  }

  private paint(hover: boolean): void {
    this.fill.tint = this.selected ? UI.panelHi : hover ? 0x242b44 : UI.panel;
    this.text.setTint(this.selected ? UI.accent : UI.text);
  }

  setSelected(v: boolean): this {
    this.selected = v;
    this.paint(false);
    return this;
  }

  setCaption(s: string): void {
    this.text.setText(s);
    this.text.position.x = Math.floor(this.bw / 2);
  }
}

/** Horizontal slider; drag with pointer. Does not rebuild the UI while dragging. */
export class Slider extends Container {
  private value: number;
  private dragging = false;
  private readonly handle: Sprite;
  private readonly fillBar: Sprite;
  private readonly readout: PixelText;
  private readonly w: number;

  constructor(
    font: PixelFont, name: string, x: number, y: number, w: number,
    min: number, max: number, step: number, initial: number,
    format: (v: number) => string, onChange: (v: number) => void,
  ) {
    super();
    this.w = w;
    this.value = initial;
    this.position.set(x, y);
    this.addChild(label(font, name, 0, 0, UI.dim));
    this.readout = label(font, format(initial), w, 0, UI.text, 'right');
    this.addChild(this.readout);
    const track = new Container();
    track.position.set(0, 8);
    track.addChild(rect(UI.border, w, 3, 0, 1));
    this.fillBar = rect(UI.accent, 1, 3, 0, 1);
    track.addChild(this.fillBar);
    this.handle = rect(UI.text, 3, 5, 0, 0);
    track.addChild(this.handle);
    track.hitArea = new Rectangle(-2, -3, w + 4, 11);
    track.eventMode = 'static';
    track.cursor = 'pointer';
    this.addChild(track);
    const set = (e: FederatedPointerEvent): void => {
      const lx = e.getLocalPosition(track).x;
      const raw = min + (Math.min(Math.max(lx, 0), w) / w) * (max - min);
      const v = Math.round(raw / step) * step;
      this.value = Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
      this.layoutHandle(min, max);
      this.readout.setText(format(this.value));
      onChange(this.value);
    };
    track.on('pointerdown', (e: FederatedPointerEvent) => { this.dragging = true; set(e); });
    track.on('globalpointermove', (e: FederatedPointerEvent) => { if (this.dragging) set(e); });
    const stop = (): void => { this.dragging = false; };
    track.on('pointerup', stop);
    track.on('pointerupoutside', stop);
    this.layoutHandle(min, max);
  }

  private layoutHandle(min: number, max: number): void {
    const px = Math.round(((this.value - min) / (max - min || 1)) * this.w);
    this.handle.x = Math.min(this.w - 3, Math.max(0, px - 1));
    this.fillBar.width = Math.max(1, px);
  }
}
