import { Container, Rectangle, Sprite } from 'pixi.js';
import type { Bootstrap, GameContext } from '../../app/GameContext.ts';
import { createRegistries, type Registries } from '../../data/registries.ts';
import { UI } from '../../data/palette.ts';
import { validateArenaFairness } from '../../domain/rules/arenaFairness.ts';
import { defaultMatchConfig } from '../../domain/rules/defaults.ts';
import { validateMatchConfig } from '../../domain/rules/validation.ts';
import { mulberry32 } from '../../core/rng.ts';
import { ZzfxPlayer } from '../audio/ZzfxPlayer.ts';
import { SpriteFactory } from '../sprites/SpriteFactory.ts';
import type { PixelText } from '../ui/PixelFont.ts';
import { virtualFor } from '../ui/layout.ts';
import { label, rect } from '../ui/widgets.ts';
import { EditorScene } from './EditorScene.ts';
import type { Scene } from './Scene.ts';

/** Registers + validates everything, builds the atlas, warms the renderer, then waits for a tap (audio unlock). Fails fast on bad data. */
export class LoadingScene implements Scene {
  readonly root = new Container();
  private readonly boot: Bootstrap;
  private readonly steps: { name: string; run: () => void }[];
  private done = 0;
  private regs: Registries | null = null;
  private sprites: SpriteFactory | null = null;
  private audio: ZzfxPlayer | null = null;
  private config: GameContext['config'] | null = null;
  private ready = false;
  private failed = false;
  private bar!: Sprite;
  private status!: PixelText;
  private w = 1;
  private h = 1;
  private t = 0;
  private readonly ui = new Container();
  private tapZone!: Sprite;

  private pendingStart = false;

  private readonly onPointerAction = (): void => {
    void this.begin();
  };

  private readonly onWindowKeyDown = (e: KeyboardEvent): void => {
    // Any user keypress begins the match
    void this.begin();
  };

  constructor(boot: Bootstrap) {
    this.boot = boot;
    this.status = label(boot.font, 'LOADING...', 0, 0, UI.dim, 'center');
    this.steps = [
      { name: 'REGISTRIES', run: () => { this.regs = createRegistries(); } },
      { name: 'SPRITE ATLAS', run: () => { this.sprites = new SpriteFactory(this.regs!.sprites); } },
      { name: 'AUDIO', run: () => { this.audio = new ZzfxPlayer(this.regs!.sounds); } },
      { name: 'VALIDATE PRESET', run: () => this.validate() },
      { name: 'WARM-UP', run: () => this.warmUp() },
    ];
    this.root.addChild(this.ui);
  }

  private validate(): void {
    const regs = this.regs!;
    const cfg = defaultMatchConfig(regs.roasters.ids(), 4);
    const errs = validateMatchConfig(cfg, regs);
    for (const layout of regs.arenas.all()) {
      for (let n = 2; n <= 12; n++) if (layout.supports(n)) errs.push(...validateArenaFairness(layout.build(n, mulberry32(n))).map((m) => `${layout.id}/${n}: ${m}`));
    }
    if (errs.length > 0) throw new Error(`Preset validation failed:\n${errs.join('\n')}`);
    this.config = cfg;
  }

  private warmUp(): void {
    try {
      if (this.sprites?.atlas) {
        const renderer = this.boot.app.renderer as unknown as { prepare?: { upload: (tex: unknown) => void } };
        if (renderer.prepare && typeof renderer.prepare.upload === 'function') {
          renderer.prepare.upload(this.sprites.atlas.source);
        }
      }
    } catch {
      // Optional warm-up; ignore if unavailable
    }
  }

  enter(): void {
    // alpha = 0.001 ensures Pixi considers tapZone renderable for pointer hit-testing
    this.tapZone = rect(0x000000, Math.max(1, this.w), Math.max(1, this.h), 0, 0, 0.001);
    this.tapZone.eventMode = 'static';
    this.tapZone.cursor = 'pointer';
    this.tapZone.on('pointerdown', this.onPointerAction);
    this.root.addChild(this.tapZone);

    // Also listen at window level for 100% reliable click/touch/keyboard detection
    window.addEventListener('pointerdown', this.onPointerAction);
    window.addEventListener('touchstart', this.onPointerAction, { passive: true });
    window.addEventListener('keydown', this.onWindowKeyDown);
    this.layout();
  }

  exit(): void {
    this.cleanupListeners();
  }

  private cleanupListeners(): void {
    window.removeEventListener('pointerdown', this.onPointerAction);
    window.removeEventListener('touchstart', this.onPointerAction);
    window.removeEventListener('keydown', this.onWindowKeyDown);
  }

  private async begin(): Promise<void> {
    if (this.failed) return;
    if (!this.ready) {
      // User tapped or pressed key while assets were still loading; auto-proceed on load completion
      this.pendingStart = true;
      return;
    }
    this.ready = false;
    this.pendingStart = false;

    try {
      if (this.audio) {
        await Promise.race([
          this.audio.resume().catch((e) => console.warn('[LoadingScene] audio resume failed:', e)),
          new Promise((resolve) => setTimeout(resolve, 250)),
        ]);
        try {
          this.audio.play('ui');
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn('[LoadingScene] audio unlock warning:', e);
    }

    this.cleanupListeners();
    const ctx: GameContext = { ...this.boot, regs: this.regs!, sprites: this.sprites!, audio: this.audio!, config: this.config! };
    this.boot.scenes.goto(new EditorScene(ctx));
  }

  private layout(): void {
    for (const c of this.ui.removeChildren()) c.destroy({ children: true });
    const v = virtualFor(this.w, this.h);
    this.ui.scale.set(v.scale);
    this.ui.position.set(v.ox, v.oy);
    this.ui.addChild(rect(UI.bg, v.w, v.h));
    const cx = Math.floor(v.w / 2);
    const title = label(this.boot.font, 'MINIT CATCH!', cx, Math.floor(v.h / 2) - 28, UI.accent, 'center');
    title.scale.set(3);
    this.ui.addChild(title);
    this.ui.addChild(rect(UI.border, 82, 6, cx - 41, Math.floor(v.h / 2) - 2));
    this.bar = rect(UI.good, 1, 4, cx - 40, Math.floor(v.h / 2) - 1);
    this.ui.addChild(this.bar);
    this.status = label(this.boot.font, this.status.text, cx, Math.floor(v.h / 2) + 10, UI.dim, 'center');
    this.ui.addChild(this.status);
    this.bar.width = Math.max(1, Math.round((this.done / this.steps.length) * 80));
    this.tapZone.width = this.w;
    this.tapZone.height = this.h;
    // Set full screen bounds for hitArea
    this.tapZone.hitArea = new Rectangle(0, 0, Math.max(1, this.w), Math.max(1, this.h));
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    if (this.tapZone !== undefined) this.layout();
  }

  update(dt: number): void {
    this.t += dt;
    if (this.failed) return;
    if (this.done < this.steps.length) {
      const step = this.steps[this.done]!;
      this.status.setText(step.name);
      try { step.run(); } catch (e) {
        this.failed = true;
        this.status.setText('LOAD FAILED - SEE CONSOLE');
        this.status.setTint(UI.bad);
        throw e;
      }
      this.done++;
      this.bar.width = Math.max(1, Math.round((this.done / this.steps.length) * 80));
      if (this.done === this.steps.length) {
        this.ready = true;
        const auto = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';
        if (this.pendingStart || auto) {
          void this.begin();
        }
      }
    } else {
      this.status.setText(Math.floor(this.t * 2) % 2 === 0 ? 'TAP TO START' : '');
      this.status.setTint(UI.text);
    }
  }

  onKey(_e: KeyboardEvent, down: boolean): void {
    if (down) void this.begin();
  }
}
