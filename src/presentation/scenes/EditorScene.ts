import { Container, Sprite, type FederatedPointerEvent } from 'pixi.js';
import type { GameContext } from '../../app/GameContext.ts';
import { arenaId, type RoasterId } from '../../core/ids.ts';
import { mulberry32 } from '../../core/rng.ts';
import { SLOT_COLORS, UI } from '../../data/palette.ts';
import { defaultChickenSpawn, MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../../domain/rules/constants.ts';
import { validateMatchConfig } from '../../domain/rules/validation.ts';
import type { RoasterDef } from '../../shared/types.ts';
import { buildPreview } from '../render/ArenaRenderer.ts';
import { virtualFor } from '../ui/layout.ts';
import { Button, Slider, label, rect } from '../ui/widgets.ts';
import type { Scene } from './Scene.ts';
import { SimulationScene } from './SimulationScene.ts';

const PRESETS = [2, 4, 7, 9] as const;
const SPEEDS = [0.5, 1, 2, 4] as const;
const ZOOM_LEVELS = [0, 1, 2, 3, 4] as const;
const ZOOM_LABELS = ['AUTO', '1X', '2X', '3X', '4X'] as const;

const ROASTER_INFO: Record<string, { role: string; desc: string }> = {
  boomer: { role: 'BOMBER', desc: 'PLANTS TIMED BOMBS THAT STUN' },
  netta: { role: 'NETTER', desc: 'CASTS NET TO IMMOBILIZE FOES' },
  dash: { role: 'SPRINTER', desc: 'DASHES FORWARD WITH SHIELD' },
  magna: { role: 'MAGNETIZER', desc: 'PULLS NEARBY FREE CHICKENS' },
  guard: { role: 'GUARDIAN', desc: 'SHIELDS SELF AGAINST ATTACKS' },
  trix: { role: 'TRICKSTER', desc: 'DROPS A DECOY TO CONFUSE FOES' },
  sabo: { role: 'SABOTEUR', desc: 'TEMPORARILY LOCKS ENEMY COOPS' },
  tank: { role: 'HEAVY', desc: 'SLAM KNOCKBACK ON NEARBY FOES' },
};

function randomSeed32(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0]! === 0 ? 1 : a[0]!;
}

/** Pure-Pixi editor with settings window, tooltip, camera zoom, random arena/seed, and mobile portrait optimization. */
export class EditorScene implements Scene {
  readonly root = new Container();
  private readonly ctx: GameContext;
  private readonly content = new Container();
  private readonly overlayLayer = new Container();
  private tooltip: Container | null = null;
  private showSettings = false;
  private seedText: string;
  private seedFocus = false;
  private error = '';
  private w = 1;
  private h = 1;
  private scrollY = 0;
  private maxScroll = 0;

  private readonly onWheel = (e: WheelEvent): void => {
    if (this.showSettings) return;
    if (this.maxScroll > 0) {
      const v = virtualFor(this.w, this.h);
      this.scrollY = Math.max(-this.maxScroll, Math.min(0, this.scrollY - e.deltaY * 0.3));
      this.content.position.y = v.oy + this.scrollY * v.scale;
    }
  };

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.seedText = String(ctx.config.seed);
    this.root.addChild(this.content, this.overlayLayer);
  }

  enter(): void {
    this.ctx.audio.startBgm();
    this.ctx.audio.setDucked(false);
    window.addEventListener('wheel', this.onWheel, { passive: true });

    this.root.eventMode = 'static';
    let dragY: number | null = null;

    this.root.on('pointerdown', (e: FederatedPointerEvent) => {
      if (this.showSettings) return;
      dragY = e.global.y;
    });

    this.root.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (this.showSettings) return;
      if (dragY !== null && this.maxScroll > 0) {
        const v = virtualFor(this.w, this.h);
        const dy = (e.global.y - dragY) / v.scale;
        if (Math.abs(dy) > 1) {
          this.scrollY = Math.max(-this.maxScroll, Math.min(0, this.scrollY + dy));
          this.content.position.y = v.oy + this.scrollY * v.scale;
          dragY = e.global.y;
        }
      }
    });

    const stopDrag = () => { dragY = null; };
    this.root.on('pointerup', stopDrag);
    this.root.on('pointerupoutside', stopDrag);

    this.build();
  }

  exit(): void {
    window.removeEventListener('wheel', this.onWheel);
    this.hideRoasterTooltip();
  }

  update(): void {}

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.build();
  }

  private setParticipants(n: number): void {
    const cfg = this.ctx.config;
    const all = this.ctx.regs.roasters.ids();
    const ids: RoasterId[] = [];
    for (let i = 0; i < n; i++) ids.push(cfg.roasterIds[i] ?? all[i % all.length]!);
    cfg.participants = n;
    cfg.roasterIds = ids;
    cfg.chickenSpawn = defaultChickenSpawn(n);
    const arena = this.ctx.regs.arenas.get(cfg.arenaId);
    if (!arena.supports(n)) cfg.arenaId = this.ctx.regs.arenas.all().find((a) => a.supports(n))!.id;
    this.build();
  }

  private commitSeed(): void {
    const v = Number(this.seedText);
    this.ctx.config.seed = Number.isInteger(v) && v >= 1 && v <= 0xffffffff ? v : this.ctx.config.seed;
    this.seedText = String(this.ctx.config.seed);
    this.seedFocus = false;
    this.build();
  }

  private start(): void {
    if (this.seedFocus) this.commitSeed();
    const cfg = this.ctx.config;

    // Auto-randomize if options enabled
    if (cfg.observer.randomSeed) {
      cfg.seed = randomSeed32();
      this.seedText = String(cfg.seed);
    }
    if (cfg.observer.randomArena) {
      const arenas = this.ctx.regs.arenas.all().filter((a) => a.supports(cfg.participants));
      if (arenas.length > 0) {
        const pick = arenas[Math.floor(Math.random() * arenas.length)]!;
        cfg.arenaId = arenaId(pick.id);
      }
    }

    const errs = validateMatchConfig(cfg, this.ctx.regs);
    if (errs.length > 0) { this.error = errs[0]!; this.build(); return; }
    this.hideRoasterTooltip();
    this.ctx.audio.play('go');
    this.ctx.scenes.goto(new SimulationScene(this.ctx, { ...cfg, roasterIds: [...cfg.roasterIds], chickenSpawn: { ...cfg.chickenSpawn }, observer: { ...cfg.observer } }));
  }

  private showRoasterTooltip(def: RoasterDef, globalX: number, globalY: number): void {
    this.hideRoasterTooltip();
    const { font } = this.ctx;
    const v = virtualFor(this.w, this.h);
    const tt = new Container();
    const tipW = 144;
    const tipH = 44;

    let vx = Math.floor((globalX - v.ox) / v.scale);
    let vy = Math.floor((globalY - v.oy) / v.scale);
    if (vy < 90) {
      vy = vy + 36;
    } else {
      vy = vy - tipH - 6;
    }
    vx = Math.max(4, Math.min(v.w - tipW - 4, vx - Math.floor(tipW / 2)));
    vy = Math.max(4, Math.min(v.h - tipH - 4, vy));

    tt.position.set(vx, vy);
    tt.addChild(rect(UI.border, tipW, tipH, 0, 0));
    tt.addChild(rect(UI.panel, tipW - 2, tipH - 2, 1, 1));
    tt.addChild(rect(def.colors.primary, tipW - 2, 2, 1, 1));

    const info = ROASTER_INFO[def.id] ?? { role: def.ability.toUpperCase(), desc: 'SPECIAL ROASTER ABILITY' };
    tt.addChild(label(font, `${def.name.toUpperCase()} (${info.role})`, 5, 5, UI.accent));
    const st = def.stats;
    tt.addChild(label(font, `SPD: ${st.moveSpeed}  MASS: ${st.mass}  GRAB: ${st.pickupRadius}M`, 5, 17, UI.text));
    tt.addChild(label(font, info.desc.slice(0, 30), 5, 29, UI.dim));

    this.tooltip = tt;
    this.overlayLayer.addChild(tt);
  }

  private hideRoasterTooltip(): void {
    if (this.tooltip) {
      this.overlayLayer.removeChild(this.tooltip);
      this.tooltip.destroy({ children: true });
      this.tooltip = null;
    }
  }

  private build(): void {
    this.hideRoasterTooltip();
    for (const c of this.content.removeChildren()) c.destroy({ children: true });
    for (const c of this.overlayLayer.removeChildren()) c.destroy({ children: true });

    const { font, regs, audio } = this.ctx;
    const cfg = this.ctx.config;
    const v = virtualFor(this.w, this.h);
    this.content.scale.set(v.scale);
    this.content.position.set(v.ox, v.oy);
    this.content.addChild(rect(UI.bg, v.w, v.h));

    this.overlayLayer.scale.set(v.scale);
    this.overlayLayer.position.set(v.ox, v.oy);

    const wide = v.w >= 280;
    const colW = wide ? Math.floor(v.w / 2) - 8 : v.w - 12;
    const lx = 6;
    const rx = wide ? Math.floor(v.w / 2) + 2 : 6;
    let ly = 5;

    // ---- header: title + settings window trigger
    this.content.addChild(label(font, 'MINIT CATCH!', lx, ly, UI.accent));
    const settingsBtn = new Button(font, 'SETTINGS', v.w - 52, 3, 46, 11, () => {
      this.showSettings = true;
      this.build();
    });
    this.content.addChild(settingsBtn);
    ly += 14;

    // ---- participants
    this.content.addChild(label(font, `PARTICIPANTS ${cfg.participants}`, lx, ly, UI.dim));
    ly += 8;
    let bx = lx;
    for (const n of PRESETS) {
      this.content.addChild(new Button(font, String(n), bx, ly, 14, 11, () => this.setParticipants(n)).setSelected(cfg.participants === n));
      bx += 16;
    }
    this.content.addChild(new Button(font, '-', bx, ly, 11, 11, () => this.setParticipants(Math.max(MIN_PARTICIPANTS, cfg.participants - 1))));
    this.content.addChild(new Button(font, '+', bx + 13, ly, 11, 11, () => this.setParticipants(Math.min(MAX_PARTICIPANTS, cfg.participants + 1))));
    ly += 15;

    // ---- match duration / timer
    this.content.addChild(label(font, `MATCH TIMER: ${cfg.durationSec}S`, lx, ly, UI.dim));
    ly += 8;
    const DURATION_PRESETS = [10, 20, 30, 60] as const;
    let tx = lx;
    for (const d of DURATION_PRESETS) {
      this.content.addChild(
        new Button(font, `${d}S`, tx, ly, 18, 11, () => {
          cfg.durationSec = d;
          audio.play('ui');
          this.build();
        }).setSelected(cfg.durationSec === d),
      );
      tx += 20;
    }
    this.content.addChild(
      new Button(font, '-5S', tx, ly, 16, 11, () => {
        cfg.durationSec = Math.max(5, cfg.durationSec - 5);
        audio.play('ui');
        this.build();
      }),
    );
    this.content.addChild(
      new Button(font, '+5S', tx + 18, ly, 16, 11, () => {
        cfg.durationSec = Math.min(180, cfg.durationSec + 5);
        audio.play('ui');
        this.build();
      }),
    );
    ly += 15;

    // ---- roster grid with hover tooltip
    this.content.addChild(label(font, 'ROSTER (TAP: CHANGE / HOVER: INFO)', lx, ly, UI.dim));
    ly += 8;
    const cw = 37;
    const ch = 32;
    const cols = Math.max(1, Math.floor(colW / cw));
    const all = regs.roasters.ids();
    cfg.roasterIds.forEach((rid, i) => {
      const def = regs.roasters.get(rid);
      const cx = lx + (i % cols) * cw;
      const cy = ly + Math.floor(i / cols) * ch;
      const cell = new Container();
      cell.position.set(cx, cy);
      cell.addChild(rect(UI.border, cw - 2, ch - 2), rect(UI.panel, cw - 4, ch - 4, 1, 1), rect(SLOT_COLORS[i % SLOT_COLORS.length]!, cw - 4, 1, 1, 1));
      const icon = new Sprite(this.ctx.sprites.frame(def.sprite));
      icon.anchor.set(0.5, 0);
      icon.position.set(Math.floor((cw - 2) / 2), 4);
      cell.addChild(icon);
      cell.addChild(label(font, def.name.toUpperCase().slice(0, 6), Math.floor((cw - 2) / 2), 19, UI.text, 'center'));
      cell.addChild(label(font, this.abilityLabel(def.ability), Math.floor((cw - 2) / 2), 25, UI.dim, 'center'));
      cell.eventMode = 'static';
      cell.cursor = 'pointer';

      cell.on('pointerover', (e: FederatedPointerEvent) => {
        this.showRoasterTooltip(def, e.global.x, e.global.y);
      });
      cell.on('pointerout', () => {
        this.hideRoasterTooltip();
      });
      cell.on('pointertap', () => {
        cfg.roasterIds[i] = all[(all.indexOf(rid) + 1) % all.length]!;
        audio.play('ui');
        this.build();
      });
      this.content.addChild(cell);
    });
    ly += Math.ceil(cfg.participants / cols) * ch + 3;

    // ---- right column (or continues below on narrow screens)
    let ry = wide ? 19 : ly;
    this.content.addChild(label(font, 'ARENA', rx, ry, UI.dim));
    const rndArenaBtn = new Button(font, cfg.observer.randomArena ? 'RND: ON' : 'RND: OFF', rx + 60, ry - 2, 42, 10, () => {
      cfg.observer.randomArena = !cfg.observer.randomArena;
      this.build();
    }).setSelected(!!cfg.observer.randomArena);
    this.content.addChild(rndArenaBtn);
    ry += 8;

    const arenas = regs.arenas.all();
    const cur = regs.arenas.get(cfg.arenaId);
    const idx = arenas.indexOf(cur);
    const pick = (d: number): void => {
      for (let k = 1; k <= arenas.length; k++) {
        const a = arenas[(idx + d * k + arenas.length * 4) % arenas.length]!;
        if (a.supports(cfg.participants)) { cfg.arenaId = arenaId(a.id); break; }
      }
      audio.play('ui');
      this.build();
    };
    this.content.addChild(new Button(font, '<', rx, ry + 14, 11, 11, () => pick(-1)));
    const prev = new Sprite(buildPreview(cur.build(cfg.participants, mulberry32(cfg.seed)), 40));
    prev.position.set(rx + 14, ry);
    this.content.addChild(prev);
    this.content.addChild(new Button(font, '>', rx + 57, ry + 14, 11, 11, () => pick(1)));
    this.content.addChild(label(font, cur.name.toUpperCase(), rx + 72, ry + 16, UI.text));
    ry += 44;

    // ---- chicken sliders
    const cs = cfg.chickenSpawn;
    const sw = Math.min(colW, 130);
    this.content.addChild(new Slider(font, 'CHICKENS START', rx, ry, sw, 0, 40, 1, cs.initial, (x) => String(x), (x) => { cs.initial = x; cs.cap = Math.max(cs.cap, x, 1); }));
    ry += 15;
    this.content.addChild(new Slider(font, 'CHICKEN CAP', rx, ry, sw, 1, 80, 1, cs.cap, (x) => String(x), (x) => { cs.cap = x; cs.initial = Math.min(cs.initial, x); }));
    ry += 15;
    this.content.addChild(new Slider(font, 'SPAWN EVERY', rx, ry, sw, 0.2, 3, 0.05, cs.interval, (x) => `${x.toFixed(2)}S`, (x) => { cs.interval = x; }));
    ry += 16;

    // ---- seed
    this.content.addChild(label(font, 'SEED', rx, ry, UI.dim));
    const seedBtn = new Button(font, this.seedText + (this.seedFocus ? '_' : ''), rx + 22, ry - 3, 56, 11, () => { this.seedFocus = true; this.build(); }).setSelected(this.seedFocus);
    this.content.addChild(seedBtn);
    this.content.addChild(new Button(font, 'RND', rx + 81, ry - 3, 20, 11, () => { cfg.seed = randomSeed32(); this.seedText = String(cfg.seed); this.seedFocus = false; this.build(); }));
    const autoSeedBtn = new Button(font, cfg.observer.randomSeed ? 'AUTO: ON' : 'AUTO: OFF', rx + 104, ry - 3, 44, 11, () => {
      cfg.observer.randomSeed = !cfg.observer.randomSeed;
      this.build();
    }).setSelected(!!cfg.observer.randomSeed);
    this.content.addChild(autoSeedBtn);
    ry += 15;

    // ---- observer: director cam, speed & zoom
    this.content.addChild(new Button(font, cfg.observer.cameraDirector ? 'DIRECTOR CAM: ON' : 'DIRECTOR CAM: OFF', rx, ry, 84, 11, () => { cfg.observer.cameraDirector = !cfg.observer.cameraDirector; this.build(); }).setSelected(cfg.observer.cameraDirector));
    ry += 14;

    this.content.addChild(label(font, 'SPEED', rx, ry + 2, UI.dim));
    let sx = rx + 26;
    for (const s of SPEEDS) {
      this.content.addChild(new Button(font, `${s}X`, sx, ry, 20, 11, () => { cfg.observer.speed = s; this.build(); }).setSelected(cfg.observer.speed === s));
      sx += 22;
    }
    ry += 14;

    this.content.addChild(label(font, 'ZOOM', rx, ry + 2, UI.dim));
    let zx = rx + 24;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      const zVal = ZOOM_LEVELS[i]!;
      const zw = i === 0 ? 24 : 16;
      this.content.addChild(new Button(font, ZOOM_LABELS[i]!, zx, ry, zw, 11, () => {
        cfg.observer.zoom = zVal;
        this.build();
      }).setSelected((cfg.observer.zoom ?? 0) === zVal));
      zx += zw + 2;
    }
    ry += 16;

    // ---- start button
    const startY = wide ? Math.max(ry, v.h - 22) : Math.max(ry, ly) + 4;
    this.content.addChild(new Button(font, 'START MATCH', rx, startY, 94, 14, () => this.start()).setSelected(true));
    if (this.error !== '') this.content.addChild(label(font, this.error.toUpperCase().slice(0, 44), 6, startY + 16, UI.bad));

    const totalHeight = startY + 24;
    this.maxScroll = Math.max(0, totalHeight - v.h);
    this.scrollY = Math.max(-this.maxScroll, Math.min(0, this.scrollY));
    this.content.position.set(v.ox, v.oy + this.scrollY * v.scale);

    // ---- Settings Modal Overlay
    if (this.showSettings) {
      this.renderSettingsModal(v.w, v.h);
    }
  }

  private renderSettingsModal(vw: number, vh: number): void {
    const { font, audio } = this.ctx;
    const cfg = this.ctx.config;

    const backdrop = rect(0x000000, vw, vh, 0, 0, 0.75);
    backdrop.eventMode = 'static';
    backdrop.cursor = 'default';
    this.overlayLayer.addChild(backdrop);

    const mw = Math.min(vw - 16, 184);
    const modal = new Container();

    let sy = 20;

    // 1. Audio toggle
    const audioBtn = new Button(font, audio.isMuted ? 'SOUND: MUTED' : 'SOUND: ENABLED', 8, sy, mw - 16, 11, () => {
      audio.toggleMute();
      this.build();
    }).setSelected(!audio.isMuted);
    modal.addChild(audioBtn);
    sy += 15;

    // 2. Match Timer
    modal.addChild(label(font, `MATCH TIMER: ${cfg.durationSec}S`, 8, sy, UI.dim));
    sy += 8;
    const presets = [10, 20, 30, 60] as const;
    let mxTimer = 8;
    for (const d of presets) {
      modal.addChild(
        new Button(font, `${d}S`, mxTimer, sy, 18, 10, () => {
          cfg.durationSec = d;
          this.build();
        }).setSelected(cfg.durationSec === d),
      );
      mxTimer += 20;
    }
    modal.addChild(
      new Button(font, '-5S', mxTimer, sy, 16, 10, () => {
        cfg.durationSec = Math.max(5, cfg.durationSec - 5);
        this.build();
      }),
    );
    modal.addChild(
      new Button(font, '+5S', mxTimer + 18, sy, 16, 10, () => {
        cfg.durationSec = Math.min(180, cfg.durationSec + 5);
        this.build();
      }),
    );
    sy += 14;

    // 3. Hide Hint in Arena Scene
    const hideHintBtn = new Button(font, cfg.observer.hideHints ? 'HINT BAR: HIDDEN' : 'HINT BAR: VISIBLE', 8, sy, mw - 16, 11, () => {
      cfg.observer.hideHints = !cfg.observer.hideHints;
      this.build();
    }).setSelected(!!cfg.observer.hideHints);
    modal.addChild(hideHintBtn);
    sy += 14;

    // 4. Hide Touch Controls in Arena Scene
    const hideCtlBtn = new Button(font, cfg.observer.hideControls ? 'BOTTOM BUTTONS: HIDDEN' : 'BOTTOM BUTTONS: VISIBLE', 8, sy, mw - 16, 11, () => {
      cfg.observer.hideControls = !cfg.observer.hideControls;
      this.build();
    }).setSelected(!!cfg.observer.hideControls);
    modal.addChild(hideCtlBtn);
    sy += 14;

    // 5. Random Arena
    const rndArenaBtn = new Button(font, cfg.observer.randomArena ? 'RANDOM ARENA: ON' : 'RANDOM ARENA: OFF', 8, sy, mw - 16, 11, () => {
      cfg.observer.randomArena = !cfg.observer.randomArena;
      this.build();
    }).setSelected(!!cfg.observer.randomArena);
    modal.addChild(rndArenaBtn);
    sy += 14;

    // 6. Random Seed
    const rndSeedBtn = new Button(font, cfg.observer.randomSeed ? 'RANDOM SEED: ON' : 'RANDOM SEED: OFF', 8, sy, mw - 16, 11, () => {
      cfg.observer.randomSeed = !cfg.observer.randomSeed;
      this.build();
    }).setSelected(!!cfg.observer.randomSeed);
    modal.addChild(rndSeedBtn);
    sy += 14;

    // 7. Camera Zoom Option
    modal.addChild(label(font, 'CAM ZOOM', 8, sy + 1, UI.dim));
    let zx = 8 + 42;
    for (let i = 0; i < ZOOM_LEVELS.length; i++) {
      const zVal = ZOOM_LEVELS[i]!;
      const zw = i === 0 ? 22 : 15;
      const zBtn = new Button(font, ZOOM_LABELS[i]!, zx, sy, zw, 10, () => {
        cfg.observer.zoom = zVal;
        this.build();
      }).setSelected((cfg.observer.zoom ?? 0) === zVal);
      modal.addChild(zBtn);
      zx += zw + 2;
    }
    sy += 15;

    // 8. Done Button
    const doneBtn = new Button(font, 'DONE', Math.floor((mw - 46) / 2), sy, 46, 12, () => {
      this.showSettings = false;
      this.build();
    }).setSelected(true);
    modal.addChild(doneBtn);
    sy += 16;

    const mh = Math.min(vh - 8, sy + 4);
    const mx = Math.floor((vw - mw) / 2);
    const my = Math.max(4, Math.floor((vh - mh) / 2));
    modal.position.set(mx, my);

    // Background boxes behind controls
    const bgContainer = new Container();
    bgContainer.addChild(rect(UI.border, mw, mh, 0, 0));
    bgContainer.addChild(rect(UI.panel, mw - 2, mh - 2, 1, 1));
    bgContainer.addChild(rect(UI.accent, mw - 2, 2, 1, 1));
    bgContainer.addChild(label(font, 'SETTINGS', 8, 5, UI.accent));
    const closeBtn = new Button(font, 'X', mw - 14, 4, 10, 10, () => {
      this.showSettings = false;
      this.build();
    });
    bgContainer.addChild(closeBtn);
    modal.addChildAt(bgContainer, 0);

    this.overlayLayer.addChild(modal);
  }

  private abilityLabel(id: string): string {
    return id.slice(0, 6).toUpperCase();
  }

  onKey(e: KeyboardEvent, down: boolean): void {
    if (!down) return;
    if (this.showSettings) {
      if (e.code === 'Escape' || e.code === 'Enter') {
        this.showSettings = false;
        this.build();
      }
      return;
    }
    if (this.seedFocus) {
      if (/^\d$/.test(e.key) && this.seedText.length < 10) { this.seedText = this.seedText === '0' ? e.key : this.seedText + e.key; this.build(); }
      else if (e.code === 'Backspace') { this.seedText = this.seedText.slice(0, -1); this.build(); }
      else if (e.code === 'Enter' || e.code === 'Escape') this.commitSeed();
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space') this.start();
    if (e.code === 'KeyM') { this.ctx.audio.toggleMute(); this.build(); }
  }
}
