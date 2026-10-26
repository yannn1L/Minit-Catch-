import { Container, type FederatedPointerEvent } from 'pixi.js';
import type { GameContext } from '../../app/GameContext.ts';
import { FixedLoop } from '../../core/FixedLoop.ts';
import { UI } from '../../data/palette.ts';
import { TICK } from '../../domain/rules/constants.ts';
import type { MatchConfig, MatchResult, SimEvent } from '../../shared/types.ts';
import { Simulation, type SimView } from '../../sim/Simulation.ts';
import { DirectorCamera, OverviewCamera, type CameraState } from '../render/DirectorCamera.ts';
import { bindAudio, bindVfx } from '../render/EventBindings.ts';
import { PPM } from '../render/ArenaRenderer.ts';
import { WorldRenderer } from '../render/WorldRenderer.ts';
import { HudView } from '../ui/HudView.ts';
import { ResultOverlay } from '../ui/ResultOverlay.ts';
import { virtualFor } from '../ui/layout.ts';
import { EditorScene } from './EditorScene.ts';
import type { Scene } from './Scene.ts';

type Phase = 'countdown' | 'active' | 'results';
const SPEEDS = [0.5, 1, 2, 4] as const;
const COUNTDOWN_SEC = 3;

export class SimulationScene implements Scene {
  readonly root = new Container();
  private readonly ctx: GameContext;
  private readonly config: MatchConfig;
  private readonly expectedHash: string | null;
  private readonly isReplay: boolean;
  private sim!: Simulation;
  private renderer!: WorldRenderer;
  private hud!: HudView;
  private overlay!: ResultOverlay;
  private readonly ui = new Container();
  private readonly loop = new FixedLoop(TICK);
  private readonly director = new DirectorCamera();
  private readonly overview = new OverviewCamera();
  private readonly cam: CameraState = { x: 0, y: 0, zoom: 0 };
  private readonly keys = new Set<string>();
  private readonly unsubs: (() => void)[] = [];
  private phase: Phase = 'countdown';
  private countdown = COUNTDOWN_SEC;
  private lastCount = COUNTDOWN_SEC + 1;
  private speedIdx: number;
  private directorOn: boolean;
  private paused = false;
  private result: MatchResult | null = null;
  private resultsT = 0;
  private clock = 0;
  private alpha = 1;
  private w = 1;
  private h = 1;
  private baseZoom = 1;
  private leader = -1;
  private names: string[] = [];

  /** `expectedHash` is set when replaying a finished match: the re-simulation must reproduce the same event-log hash. */
  constructor(ctx: GameContext, config: MatchConfig, expectedHash: string | null = null, isReplay = false) {
    this.ctx = ctx;
    this.config = config;
    this.expectedHash = expectedHash;
    this.isReplay = isReplay;
    const idx = SPEEDS.indexOf(config.observer.speed as (typeof SPEEDS)[number]);
    this.speedIdx = idx >= 0 ? idx : 1;
    this.directorOn = config.observer.cameraDirector;
  }

  enter(): void {
    const { regs, sprites, font, audio } = this.ctx;
    audio.playTrack('sim');
    this.sim = new Simulation(this.config, regs);
    const view: SimView = this.sim.view;
    const defs = this.sim.roasters.map((r) => regs.roasters.get(r.roasterId));
    this.names = defs.map((d) => d.name);
    this.renderer = new WorldRenderer(sprites, font, view, defs);
    this.hud = new HudView(font, view, defs, this.sim.abilities, {
      onTogglePause: () => {
        if (this.phase !== 'results') {
          this.paused = !this.paused;
          this.syncHud();
        }
      },
      onCycleSpeed: () => {
        this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
        this.syncHud();
      },
      onToggleCam: () => {
        this.directorOn = !this.directorOn;
        if (!this.directorOn) {
          this.director.targetRoasterSlot = null;
          this.renderer.selectedSlot = null;
        }
        this.syncHud();
      },
      onToggleMute: () => {
        this.ctx.audio.toggleMute();
        this.syncHud();
      },
      onExit: () => {
        this.ctx.audio.playTrack('editor');
        this.ctx.scenes.goto(new EditorScene(this.ctx));
      },
    });
    this.overlay = new ResultOverlay(font);
    this.ui.addChild(this.hud.root, this.overlay.root);
    this.root.addChild(this.renderer.world, this.ui);

    // Touch gesture camera drag and pinch-to-zoom for mobile, plus director follow click
    this.root.eventMode = 'static';
    let dragStart: { x: number; y: number } | null = null;
    let clickStart: { x: number; y: number } | null = null;
    let initialDist: number | null = null;
    let initialZoom = 1;
    const touches = new Map<number, { x: number; y: number }>();

    const onDown = (e: FederatedPointerEvent) => {
      touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
      clickStart = { x: e.global.x, y: e.global.y };
      if (touches.size === 1 && !this.directorOn) {
        dragStart = { x: e.global.x, y: e.global.y };
      } else if (touches.size === 2) {
        const arr = [...touches.values()];
        initialDist = Math.hypot(arr[0]!.x - arr[1]!.x, arr[0]!.y - arr[1]!.y);
        initialZoom = this.cam.zoom || this.baseZoom;
      }
    };
    const onMove = (e: FederatedPointerEvent) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.global.x, y: e.global.y });
      }
      if (touches.size === 2 && initialDist && initialDist > 0 && !this.directorOn) {
        const arr = [...touches.values()];
        const curDist = Math.hypot(arr[0]!.x - arr[1]!.x, arr[0]!.y - arr[1]!.y);
        const z = Math.max(1, Math.min(8, Math.round(initialZoom * (curDist / initialDist))));
        this.cam.zoom = z;
      } else if (touches.size === 1 && dragStart && !this.directorOn) {
        const z = Math.max(1, this.cam.zoom || this.baseZoom);
        const dx = (e.global.x - dragStart.x) / (PPM * z);
        const dy = (e.global.y - dragStart.y) / (PPM * z);
        this.cam.x -= dx;
        this.cam.y -= dy;
        const lim = this.sim.arena.radius;
        this.cam.x = Math.max(-lim, Math.min(lim, this.cam.x));
        this.cam.y = Math.max(-lim, Math.min(lim, this.cam.y));
        dragStart = { x: e.global.x, y: e.global.y };
      }
    };
    const onUp = (e: FederatedPointerEvent) => {
      // Check if tap on roaster while director is on
      if (clickStart && Math.hypot(e.global.x - clickStart.x, e.global.y - clickStart.y) < 8) {
        if (this.directorOn) {
          const z = Math.max(1, this.cam.zoom);
          const worldX = (e.global.x - Math.round(this.w / 2 - this.cam.x * PPM * z)) / (PPM * z);
          const worldY = (e.global.y - Math.round(this.h / 2 - this.cam.y * PPM * z)) / (PPM * z);
          let targetSlot: number | null = null;
          let bestDist = 1.6;
          for (const r of this.sim.roasters) {
            const d = Math.hypot(r.x - worldX, r.y - worldY);
            if (d < bestDist) {
              bestDist = d;
              targetSlot = r.slot;
            }
          }
          if (targetSlot !== null) {
            if (this.director.targetRoasterSlot === targetSlot) {
              this.director.targetRoasterSlot = null;
              this.renderer.selectedSlot = null;
              this.hud.pushBanner('DIRECTOR: AUTO');
            } else {
              this.director.targetRoasterSlot = targetSlot;
              this.renderer.selectedSlot = targetSlot;
              const name = this.names[targetSlot] ?? `ROASTER ${targetSlot + 1}`;
              this.hud.pushBanner(`FOLLOWING ${name.toUpperCase()}`);
            }
          } else if (this.director.targetRoasterSlot !== null) {
            this.director.targetRoasterSlot = null;
            this.renderer.selectedSlot = null;
            this.hud.pushBanner('DIRECTOR: AUTO');
          }
        }
      }
      clickStart = null;
      touches.delete(e.pointerId);
      if (touches.size === 0) {
        dragStart = null;
        initialDist = null;
      } else if (touches.size === 1) {
        const arr = [...touches.values()][0]!;
        dragStart = { x: arr.x, y: arr.y };
        initialDist = null;
      }
    };
    this.root.on('pointerdown', onDown);
    this.root.on('globalpointermove', onMove);
    this.root.on('pointerup', onUp);
    this.root.on('pointerupoutside', onUp);
    this.root.on('pointercancel', onUp);

    const where = (slot: number): { x: number; y: number } => {
      const r = this.sim.roasters[slot]!;
      return { x: r.x, y: r.y };
    };
    this.unsubs.push(
      this.sim.events.bus.on((ev) => {
        bindAudio(ev, audio);
        bindVfx(ev, this.renderer.vfx, sprites, where, (xm, ym, msg, color) => {
          this.renderer.spawnFloater(xm, ym, msg, color);
        });
        this.banner(ev);
      }),
    );
    this.sim.events.flush(); // deliver tick-0 spawn events to subscribers before the countdown
    audio.setDucked(true);
    audio.startBgm();
    this.cam.zoom = 0;
    const reqZoom = this.config.observer.zoom;
    this.director.forcedZoom = reqZoom !== undefined && reqZoom > 0 ? reqZoom : null;
    this.hud.setHiddenOptions(!!this.config.observer.hideControls, !!this.config.observer.hideHints);
    this.resize(this.w, this.h);
    this.hud.setClock(this.config.durationSec);
    this.syncHud();
    if (this.isReplay) this.hud.setStatus('REPLAY', UI.accent);
  }

  private syncHud(): void {
    if (!this.hud) return;
    this.hud.setControlsState(this.paused, SPEEDS[this.speedIdx]!, this.directorOn, this.ctx.audio.isMuted);
    this.hud.setStatus(
      `${this.paused ? 'PAUSED ' : ''}${SPEEDS[this.speedIdx]}X ${this.directorOn ? 'DIR' : 'FREE'}${this.isReplay ? ' REP' : ''}`,
      this.paused ? UI.accent : UI.dim,
    );
  }

  exit(): void {
    for (const u of this.unsubs) u();
    this.ctx.audio.setDucked(false);
  }

  private banner(ev: SimEvent): void {
    const n = (i: number): string => (this.names[i] ?? '?').toUpperCase();
    switch (ev.t) {
      case 'bomb': if (ev.hits > 0) this.hud.pushBanner(`${n(ev.owner)} STUNNED ${ev.hits} ROASTER${ev.hits > 1 ? 'S' : ''}!`); break;
      case 'lock': this.hud.pushBanner(`${n(ev.by)} LOCKED COOP ${ev.coop + 1}!`); break;
      case 'overtime': this.hud.pushBanner('OVERTIME! NEXT SCORE WINS'); break;
      case 'lure': this.hud.pushBanner(`${n(ev.owner)} DROPPED A DECOY!`); break;
      case 'ability':
        if (ev.hits > 0 && ev.ability === 'netter') this.hud.pushBanner(`${n(ev.roaster)} NETTED ${ev.hits}!`);
        else if (ev.hits > 0 && ev.ability === 'heavy') this.hud.pushBanner(`${n(ev.roaster)} SLAMMED ${ev.hits}!`);
        else if (ev.hits > 0 && ev.ability === 'magnetizer') this.hud.pushBanner(`${n(ev.roaster)} PULLED ${ev.hits} CHICKENS!`);
        break;
      case 'deliver': {
        if (this.sim.isTagTeam) {
          const ts = this.sim.teamScores();
          const teamLead = ts[0] > ts[1] ? 0 : ts[1] > ts[0] ? 1 : -1;
          if (teamLead >= 0 && teamLead !== this.leader && Math.max(ts[0], ts[1]) > 1) {
            this.hud.pushBanner(teamLead === 0 ? 'TEAM RED TAKES THE LEAD!' : 'TEAM BLUE TAKES THE LEAD!');
          }
          this.leader = teamLead;
        } else {
          let best = -1;
          let top = 0;
          let tie = false;
          for (const c of this.sim.coops) { if (c.score > top) { top = c.score; best = c.slot; tie = false; } else if (c.score === top) tie = true; }
          const lead = tie ? -1 : best;
          if (lead >= 0 && lead !== this.leader && top > 1) this.hud.pushBanner(`${n(lead)} TAKES THE LEAD!`);
          this.leader = lead;
        }
        break;
      }
      default: break;
    }
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    if (this.hud === undefined) return;
    const r = this.sim.arena.radius;
    this.baseZoom = Math.max(1, Math.floor((Math.min(w, h) * 0.94) / (2 * r * PPM)));
    const v = virtualFor(w, h);
    this.ui.scale.set(v.scale);
    this.ui.position.set(v.ox, v.oy);
    this.hud.layout(v.w, v.h);
    if (this.result !== null && this.phase === 'results' && this.resultsT > 1) this.showOverlay();
  }

  private showOverlay(): void {
    const v = virtualFor(this.w, this.h);
    let note = '';
    if (this.expectedHash !== null && this.result !== null) note = this.result.eventHash === this.expectedHash ? 'REPLAY OK: IDENTICAL LOG' : 'REPLAY MISMATCH!';
    this.overlay.show(
      this.result!,
      this.names,
      v.w,
      v.h,
      note,
      () => this.ctx.scenes.goto(new SimulationScene(this.ctx, this.config, this.result?.eventHash ?? null, true)),
      () => {
        this.ctx.audio.playTrack('editor');
        this.ctx.scenes.goto(new EditorScene(this.ctx));
      },
    );
  }

  onKey(e: KeyboardEvent, down: boolean): void {
    if (!down) { this.keys.delete(e.code); return; }
    this.keys.add(e.code);
    if (e.repeat) return;
    if (this.phase === 'results' && (e.code === 'Enter' || e.code === 'Space')) {
      this.ctx.scenes.goto(new SimulationScene(this.ctx, this.config, this.result?.eventHash ?? null, true));
      return;
    }
    switch (e.code) {
      case 'Space': if (this.phase !== 'results') this.paused = !this.paused; break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': this.speedIdx = Number(e.code.slice(5)) - 1; break;
      case 'KeyC':
        this.directorOn = !this.directorOn;
        if (!this.directorOn) {
          this.director.targetRoasterSlot = null;
          this.renderer.selectedSlot = null;
        }
        break;
      case 'KeyM': this.ctx.audio.toggleMute(); break;
      case 'KeyR': this.ctx.scenes.goto(new SimulationScene(this.ctx, this.config, this.result?.eventHash ?? null, true)); return;
      case 'Escape': this.ctx.scenes.goto(new EditorScene(this.ctx)); return;
      case 'Equal': case 'NumpadAdd': if (!this.directorOn) this.cam.zoom = Math.min(8, this.cam.zoom + 1); break;
      case 'Minus': case 'NumpadSubtract': if (!this.directorOn) this.cam.zoom = Math.max(1, this.cam.zoom - 1); break;
      default: break;
    }
    this.syncHud();
  }

  update(dt: number): void {
    this.clock += dt;
    const view = this.sim.view;
    if (this.phase === 'countdown') {
      if (!this.paused) this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastCount) {
        this.lastCount = c;
        if (c > 0) { this.ctx.audio.play('countdown'); this.hud.setCenter(String(c), 4, UI.accent); } else { this.ctx.audio.play('go'); this.hud.setCenter('GO!', 4, UI.good); }
      }
      if (this.countdown <= -0.5) { this.hud.setCenter(''); this.phase = 'active'; this.loop.reset(); } else if (this.countdown <= 0) this.hud.setCenter('GO!', 4, UI.good);
      this.alpha = 1;
    } else if (this.phase === 'active') {
      if (!this.paused) {
        this.alpha = this.loop.advance(dt * SPEEDS[this.speedIdx]!, () => this.sim.step());
        if (this.sim.ended) {
          this.phase = 'results';
          this.result = this.sim.result();
          this.resultsT = 0;
          this.alpha = 1;
        }
      }
      this.hud.setClock(view.phase === 'overtime' ? this.sim.overtimeEndTick * TICK - view.time : this.config.durationSec - view.time);
    } else {
      this.resultsT += dt;
      if (this.resultsT > 1 && !this.overlay.root.visible) this.showOverlay();
    }

    this.hud.setStatus(`${this.paused ? 'PAUSED ' : ''}${SPEEDS[this.speedIdx]}X ${this.directorOn ? 'DIR' : 'FREE'}${this.isReplay ? ' REP' : ''}`, this.paused ? UI.accent : UI.dim);
    this.updateCamera(view, dt);
    this.renderer.vfx.update(this.paused ? 0 : dt * SPEEDS[this.speedIdx]!);
    this.renderer.updateFloaters(this.paused ? 0 : dt * SPEEDS[this.speedIdx]!);
    this.renderer.render(view, this.alpha, this.clock);
    this.hud.update(dt, view);
  }

  private updateCamera(view: SimView, dt: number): void {
    if (this.phase === 'results') this.overview.update(view, dt, this.cam, this.baseZoom);
    else if (this.directorOn) this.director.update(view, dt, this.cam, this.baseZoom);
    else {
      if (this.cam.zoom < 1) this.cam.zoom = this.baseZoom;
      const sp = (14 * dt) / this.cam.zoom * 2;
      const k = this.keys;
      if (k.has('ArrowLeft') || k.has('KeyA')) this.cam.x -= sp;
      if (k.has('ArrowRight') || k.has('KeyD')) this.cam.x += sp;
      if (k.has('ArrowUp') || k.has('KeyW')) this.cam.y -= sp;
      if (k.has('ArrowDown') || k.has('KeyS')) this.cam.y += sp;
      const lim = view.arena.radius;
      this.cam.x = Math.max(-lim, Math.min(lim, this.cam.x));
      this.cam.y = Math.max(-lim, Math.min(lim, this.cam.y));
    }
    const z = Math.max(1, this.cam.zoom);
    const world = this.renderer.world;
    world.scale.set(z); // integer zoom + integer offset => pixel-perfect
    world.position.set(Math.round(this.w / 2 - this.cam.x * PPM * z), Math.round(this.h / 2 - this.cam.y * PPM * z));
  }
}
