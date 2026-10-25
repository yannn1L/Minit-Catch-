import { Container, Sprite } from 'pixi.js';
import { SLOT_COLORS, UI } from '../../data/palette.ts';
import type { SimView } from '../../sim/Simulation.ts';
import type { RoasterDef } from '../../shared/types.ts';
import type { AbilityStrategy } from '../../domain/strategies/ability.ts';
import { PixelText, type PixelFont } from './PixelFont.ts';
import { Button, label, rect } from './widgets.ts';

export interface HudActions {
  onTogglePause?: () => void;
  onCycleSpeed?: () => void;
  onToggleCam?: () => void;
  onToggleMute?: () => void;
  onExit?: () => void;
}

interface Row { root: Container; swatch: Sprite; name: PixelText; score: PixelText; barBg: Sprite; bar: Sprite; mark: PixelText }

/** Screen-space HUD in virtual (integer-scaled) pixels: scoreboard + cooldowns, timer, banner, mobile touch buttons. */
export class HudView {
  readonly root = new Container();
  private readonly rows: Row[] = [];
  private readonly rowHeight = 9;
  private readonly timer: PixelText;
  private readonly status: PixelText;
  private readonly hint: PixelText;
  private readonly banner: PixelText;
  private readonly center: PixelText;
  private readonly bannerBg: Sprite;
  private readonly queue: string[] = [];
  private bannerLeft = 0;
  private order = '';
  private vw = 320;
  private vh = 180;
  private readonly abilities: readonly AbilityStrategy[];
  private readonly actions?: HudActions;

  readonly pauseBtn: Button;
  readonly speedBtn: Button;
  readonly camBtn: Button;
  readonly muteBtn: Button;
  readonly exitBtn: Button;
  readonly controls = new Container();

  constructor(font: PixelFont, view: SimView, defs: readonly RoasterDef[], abilities: readonly AbilityStrategy[], actions?: HudActions) {
    this.abilities = abilities;
    this.actions = actions;

    view.roasters.forEach((r, i) => {
      const def = defs.find((d) => d.id === r.roasterId)!;
      const root = new Container();
      const swatch = rect(SLOT_COLORS[i % SLOT_COLORS.length]!, 4, 5, 0, 0);
      const name = label(font, def.name.toUpperCase().slice(0, 6), 6, 0, UI.text);
      const score = label(font, '0', 40, 0, UI.text, 'right');
      const barBg = rect(UI.border, 14, 2, 44, 2);
      const bar = rect(UI.good, 14, 2, 44, 2);
      const mark = label(font, '>', -5, 0, UI.accent);
      mark.visible = false;
      root.addChild(swatch, name, score, barBg, bar, mark);
      this.root.addChild(root);
      this.rows.push({ root, swatch, name, score, barBg, bar, mark });
    });

    this.timer = label(font, '0:20', 0, 3, UI.text, 'center');
    this.status = label(font, '', 0, 3, UI.dim, 'right');
    this.hint = label(font, 'SPACE PAUSE  1-4 SPEED  C CAM  M MUTE  ESC EDIT', 0, 0, UI.dim, 'center');
    this.bannerBg = rect(0x000000, 10, 9, 0, 0, 0.55);
    this.bannerBg.visible = false;
    this.banner = label(font, '', 0, 0, UI.accent, 'center');
    this.center = label(font, '', 0, 0, UI.text, 'center');

    // Touch controls for mobile & desktop
    this.pauseBtn = new Button(font, 'PAUSE', 0, 0, 32, 11, () => this.actions?.onTogglePause?.());
    this.speedBtn = new Button(font, '1X', 0, 0, 22, 11, () => this.actions?.onCycleSpeed?.());
    this.camBtn = new Button(font, 'DIR', 0, 0, 24, 11, () => this.actions?.onToggleCam?.());
    this.muteBtn = new Button(font, 'SND', 0, 0, 24, 11, () => this.actions?.onToggleMute?.());
    this.exitBtn = new Button(font, 'ESC', 0, 0, 22, 11, () => this.actions?.onExit?.());

    this.controls.addChild(this.pauseBtn, this.speedBtn, this.camBtn, this.muteBtn, this.exitBtn);
    this.root.addChild(this.timer, this.status, this.hint, this.bannerBg, this.banner, this.center, this.controls);
  }

  private hideHints = false;
  private hideControls = false;

  setHiddenOptions(hideControls: boolean, hideHints: boolean): void {
    this.hideControls = hideControls;
    this.hideHints = hideHints;
    this.controls.visible = !hideControls;
    if (hideHints) {
      this.hint.visible = false;
    }
  }

  setControlsState(paused: boolean, speed: number, director: boolean, muted: boolean): void {
    this.pauseBtn.setCaption(paused ? 'PLAY' : 'PAUSE');
    this.pauseBtn.setSelected(paused);
    this.speedBtn.setCaption(`${speed}X`);
    this.camBtn.setCaption(director ? 'DIR' : 'FREE');
    this.camBtn.setSelected(director);
    this.muteBtn.setCaption(muted ? 'MUTE' : 'SND');
    this.muteBtn.setSelected(muted);
  }

  layout(vw: number, vh: number): void {
    this.vw = vw;
    this.vh = vh;
    this.timer.position.set(Math.floor(vw / 2), 3);
    this.status.position.set(vw - 3, 3);
    this.banner.position.set(Math.floor(vw / 2), vh - 26);
    this.center.position.set(Math.floor(vw / 2), Math.floor(vh / 2) - 20);

    const isNarrow = vw < 260;
    this.controls.visible = !this.hideControls;
    this.hint.visible = !this.hideHints && vw >= 320;
    if (this.hint.visible) {
      this.hint.position.set(Math.floor(vw / 2), vh - 22);
    }

    // Position touch controls along bottom
    const bw1 = isNarrow ? 28 : 32;
    const bw2 = isNarrow ? 20 : 24;
    const bw3 = isNarrow ? 22 : 26;
    const bw4 = isNarrow ? 22 : 26;
    const bw5 = isNarrow ? 20 : 24;
    const gap = 2;
    const totalW = bw1 + bw2 + bw3 + bw4 + bw5 + gap * 4;
    const startX = Math.floor((vw - totalW) / 2);
    const by = vh - 13;

    let cx = startX;
    this.pauseBtn.position.set(cx, by); cx += bw1 + gap;
    this.speedBtn.position.set(cx, by); cx += bw2 + gap;
    this.camBtn.position.set(cx, by);   cx += bw3 + gap;
    this.muteBtn.position.set(cx, by);  cx += bw4 + gap;
    this.exitBtn.position.set(cx, by);

    this.order = '';
  }

  pushBanner(text: string): void {
    if (this.queue.length < 3) this.queue.push(text);
  }

  setCenter(text: string, scale = 1, tint: number = UI.text): void {
    this.center.setText(text);
    this.center.setTint(tint);
    this.center.scale.set(scale);
  }

  setStatus(text: string, tint: number = UI.dim): void {
    this.status.setText(text);
    this.status.setTint(tint);
  }

  setClock(seconds: number): void {
    const s = Math.max(0, Math.ceil(seconds));
    this.timer.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
  }

  update(dt: number, view: SimView): void {
    // scoreboard order: points desc, then slot
    const idx = view.coops.map((c) => c.slot).sort((a, b) => view.coops[b]!.score - view.coops[a]!.score || a - b);
    const key = idx.map((i) => `${i}:${view.coops[i]!.score}`).join(',');
    const top = view.coops[idx[0]!]!.score;
    if (key !== this.order) {
      this.order = key;
      idx.forEach((slot, pos) => {
        const row = this.rows[slot]!;
        row.root.position.set(8, 3 + pos * this.rowHeight);
        const sc = view.coops[slot]!.score;
        row.score.setText(String(sc));
        row.mark.visible = sc > 0 && sc === top && view.coops.filter((c) => c.score === top).length === 1;
      });
    }
    for (let i = 0; i < this.rows.length; i++) {
      const r = view.roasters[i]!;
      const cd = this.abilities[i]!.cooldown;
      const f = Math.max(0, Math.min(1, 1 - r.cooldownLeft / cd));
      const row = this.rows[i]!;
      row.bar.width = Math.max(1, Math.round(14 * f));
      row.bar.tint = f >= 1 ? UI.good : UI.accent;
      row.name.setTint(r.state === 'stun' ? UI.bad : UI.text);
    }
    // banner
    if (this.bannerLeft > 0) this.bannerLeft -= dt;
    if (this.bannerLeft <= 0) {
      const next = this.queue.shift();
      if (next !== undefined) { this.banner.setText(next); this.bannerLeft = 1.7; } else this.banner.setText('');
    }
    const has = this.banner.text !== '';
    this.bannerBg.visible = has;
    if (has) {
      this.bannerBg.width = this.banner.textWidth + 8;
      this.bannerBg.position.set(Math.floor(this.vw / 2 - this.banner.textWidth / 2) - 4, this.vh - 24);
      this.banner.alpha = Math.min(1, this.bannerLeft * 4);
    }
  }
}
