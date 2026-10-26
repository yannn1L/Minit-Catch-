import { Container, Particle, ParticleContainer, Sprite } from 'pixi.js';
import { spriteId } from '../../core/ids.ts';
import { SLOT_COLORS, TEAM_COLORS } from '../../data/palette.ts';
import type { RoasterDef } from '../../shared/types.ts';
import type { SimView } from '../../sim/Simulation.ts';
import type { SpriteFactory } from '../sprites/SpriteFactory.ts';
import { PixelText, type PixelFont } from '../ui/PixelFont.ts';
import { buildGround, PPM } from './ArenaRenderer.ts';
import { Vfx } from './Vfx.ts';

const SHADOW = spriteId('ring');
const px = (m: number): number => Math.round(m * PPM);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface RoasterView {
  root: Container;
  ring: Sprite;
  body: Sprite;
  held: Sprite;
  bubble: Sprite;
  crown: Sprite;
  focus: Sprite;
  num: PixelText;
  def: RoasterDef;
}
interface CoopView { root: Container; lock: Sprite; score: PixelText }

interface Floater {
  readonly text: PixelText;
  xm: number;
  ym: number;
  offsetY: number;
  life: number;
  maxLife: number;
}

/** World-space presentation: z-order ground < coop < chicken < roaster < vfx < floaters (UI lives in a separate root). */
export class WorldRenderer {
  readonly world = new Container();
  readonly vfx: Vfx;
  selectedSlot: number | null = null;
  private readonly sprites: SpriteFactory;
  private readonly font: PixelFont;
  private readonly chickenLayer: ParticleContainer;
  private readonly chickenParticles: Particle[] = [];
  private readonly chickenTex: (object | null)[] = [];
  private readonly roasters: RoasterView[] = [];
  private readonly coops: CoopView[] = [];
  private readonly bombSprites: Sprite[] = [];
  private readonly lureSprites: Sprite[] = [];
  private readonly storedCount: number[] = [];
  private readonly floaterLayer = new Container();
  private readonly floaters: Floater[] = [];

  constructor(sprites: SpriteFactory, font: PixelFont, view: SimView, defs: readonly RoasterDef[]) {
    this.sprites = sprites;
    this.font = font;
    const ground = buildGround(view.arena);
    const g = new Sprite(ground.texture);
    g.position.set(ground.originPx, ground.originPx);
    this.world.addChild(g);

    const isTag = !!(view as any).isTagTeam;
    const half = Math.floor(view.coops.length / 2);

    const coopLayer = new Container();
    view.coops.forEach((c, i) => {
      const root = new Container();
      root.position.set(px(c.x), px(c.y));
      const coopColorIdx = isTag ? (i < half ? 0 : 1) : (i % SLOT_COLORS.length);
      const s = new Sprite(sprites.frame(spriteId(`coop_${coopColorIdx}`)));
      s.anchor.set(0.5, 0.6);
      const lock = new Sprite(sprites.frame(spriteId('lock')));
      lock.anchor.set(0.5, 1);
      lock.position.set(0, -10);
      lock.visible = false;
      const score = new PixelText(font, '0', 0xffffff, 'center');
      score.position.set(0, 12);
      root.addChild(s, lock, score);
      coopLayer.addChild(root);
      this.coops.push({ root, lock, score });
      this.storedCount.push(0);
    });
    this.world.addChild(coopLayer);

    this.chickenLayer = new ParticleContainer({
      texture: sprites.atlas,
      dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: true },
    });
    this.world.addChild(this.chickenLayer);

    const propLayer = new Container();
    for (let i = 0; i < 16; i++) {
      const b = new Sprite(sprites.frame(spriteId('bomb')));
      b.anchor.set(0.5, 0.7);
      b.visible = false;
      const l = new Sprite(sprites.frame(spriteId('chicken'), 'idle'));
      l.anchor.set(0.5, 0.8);
      l.tint = 0xff9ad5;
      l.visible = false;
      propLayer.addChild(b, l);
      this.bombSprites.push(b);
      this.lureSprites.push(l);
    }
    this.world.addChild(propLayer);

    const roasterLayer = new Container();
    roasterLayer.sortableChildren = true;
    view.roasters.forEach((r, i) => {
      const def = defs.find((d) => d.id === r.roasterId)!;
      const root = new Container();
      const slotColor = isTag ? (i < half ? TEAM_COLORS.red : TEAM_COLORS.blue) : SLOT_COLORS[i % SLOT_COLORS.length]!;
      const ring = new Sprite(sprites.frame(SHADOW));
      ring.anchor.set(0.5, 0.5);
      ring.position.set(0, 3); // Ground level, directly under roaster feet (body is at 0, 3 with anchor 0.5, 1)
      ring.tint = slotColor;
      const body = new Sprite(sprites.frame(def.sprite));
      body.anchor.set(0.5, 1);
      body.position.set(0, 3);
      const held = new Sprite(sprites.frame(spriteId('chicken'), 'carry'));
      held.anchor.set(0.5, 1);
      held.position.set(0, -11);
      held.visible = false;
      const bubble = new Sprite(sprites.frame(spriteId('bubble')));
      bubble.anchor.set(0.5, 0.65);
      bubble.alpha = 0.8;
      bubble.visible = false;
      const crown = new Sprite(sprites.frame(spriteId('crown')));
      crown.anchor.set(0.5, 1);
      crown.position.set(0, -19);
      crown.visible = false;
      const focus = new Sprite(sprites.frame(spriteId('star')));
      focus.anchor.set(0.5, 0.5);
      focus.position.set(0, -26);
      focus.tint = 0xffe600;
      focus.visible = false;
      const numLabel = isTag ? (i < half ? `R${i + 1}` : `B${i - half + 1}`) : String(i + 1);
      const num = new PixelText(font, numLabel, slotColor, 'center');
      num.position.set(0, 8); // Cleanly beneath ground ring
      root.addChild(ring, body, held, bubble, crown, focus, num);
      roasterLayer.addChild(root);
      this.roasters.push({ root, ring, body, held, bubble, crown, focus, num, def });
    });
    this.world.addChild(roasterLayer);

    this.vfx = new Vfx(sprites.atlas);
    this.world.addChild(this.vfx.layer);
    this.world.addChild(this.floaterLayer);
  }

  private chickenParticle(i: number): Particle {
    let p = this.chickenParticles[i];
    if (p === undefined) {
      p = new Particle({ texture: this.sprites.frame(spriteId('chicken')), anchorX: 0.5, anchorY: 0.8 });
      this.chickenParticles[i] = p;
      this.chickenLayer.addParticle(p);
    }
    return p;
  }

  render(view: SimView, alpha: number, time: number): void {
    const t = view.time;
    let leader = -1;
    let best = 0;
    let tie = false;
    for (const c of view.coops) {
      if (c.score > best) { best = c.score; leader = c.slot; tie = false; } else if (c.score === best && best > 0) tie = true;
    }
    if (tie) leader = -1;

    // coops
    for (let i = 0; i < this.coops.length; i++) {
      const cv = this.coops[i]!;
      const c = view.coops[i]!;
      cv.score.setText(String(c.score));
      cv.lock.visible = t < c.lockUntil;
      this.storedCount[i] = 0;
    }

    // roasters
    for (let i = 0; i < this.roasters.length; i++) {
      const rv = this.roasters[i]!;
      const r = view.roasters[i]!;
      const x = px(lerp(r.px, r.x, alpha));
      const y = px(lerp(r.py, r.y, alpha));
      rv.root.position.set(x, y);
      rv.root.zIndex = y;
      const speed = Math.hypot(r.vx, r.vy);
      const anim = r.state === 'stun' ? 'stun' : r.carried >= 0 ? 'carry' : speed > 0.6 ? 'run' : 'idle';
      const fps = anim === 'run' ? 12 : anim === 'idle' ? 3 : 7;
      const frames = this.sprites.frames(rv.def.sprite, anim);
      rv.body.texture = frames[Math.floor(time * fps + i) % frames.length]!;
      rv.body.scale.x = r.dirX < -0.05 ? -1 : r.dirX > 0.05 ? 1 : rv.body.scale.x;
      rv.body.tint = t < r.rootUntil ? 0x8fb6ff : 0xffffff;
      rv.held.visible = r.carried >= 0;
      if (r.carried >= 0) {
        const f = this.sprites.frames(spriteId('chicken'), 'carry');
        rv.held.texture = f[Math.floor(time * 8) % f.length]!;
      }
      rv.bubble.visible = t < r.shieldUntil;
      rv.crown.visible = leader === i;
      rv.ring.alpha = 0.9;
      rv.focus.visible = this.selectedSlot === i;
      if (rv.focus.visible) {
        rv.focus.rotation = time * 4.5;
      }
    }

    // chickens
    for (let i = 0; i < view.chickenCount; i++) {
      const c = view.chickens[i]!;
      const p = this.chickenParticle(i);
      let wx: number, wy: number, anim: 'idle' | 'run' | 'carry' = 'idle';
      let flip = 1;
      if (c.state === 'carried') {
        const r = view.roasters[c.carrier]!;
        wx = px(lerp(r.px, r.x, alpha));
        wy = px(lerp(r.py, r.y, alpha)) - 11 + 0;
        anim = 'carry';
        flip = r.dirX < 0 ? -1 : 1;
      } else if (c.state === 'stored') {
        const coop = view.coops.find((k) => Math.abs(k.x - c.x) < 0.01 && Math.abs(k.y - c.y) < 0.01);
        const k = coop === undefined ? 0 : this.storedCount[coop.slot]!++;
        const inward = coop === undefined ? 0 : Math.atan2(-coop.y, -coop.x);
        const col = (k % 5) - 2;
        const row = Math.floor(k / 5);
        wx = px(c.x) + Math.round(Math.cos(inward) * (16 + row * 6) - Math.sin(inward) * col * 7);
        wy = px(c.y) + Math.round(Math.sin(inward) * (16 + row * 6) + Math.cos(inward) * col * 7);
      } else {
        wx = px(lerp(c.px, c.x, alpha));
        wy = px(lerp(c.py, c.y, alpha));
        anim = Math.hypot(c.vx, c.vy) > 0.4 ? 'run' : 'idle';
        flip = c.vx < -0.1 ? -1 : 1;
      }
      const frames = this.sprites.frames(spriteId('chicken'), anim);
      const tex = frames[Math.floor(time * (anim === 'run' ? 10 : 3) + i) % frames.length]!;
      if (this.chickenTex[i] !== tex) { p.texture = tex; this.chickenTex[i] = tex; }
      p.x = wx;
      p.y = wy;
      p.scaleX = flip;
    }

    // Hide any pooled particles exceeding current active count
    for (let i = view.chickenCount; i < this.chickenParticles.length; i++) {
      const p = this.chickenParticles[i]!;
      p.x = -9999;
      p.y = -9999;
    }

    // bombs + lures
    for (let i = 0; i < 16; i++) {
      const b = view.bombs[i]!;
      const bs = this.bombSprites[i]!;
      bs.visible = b.alive;
      if (b.alive) bs.position.set(px(b.x), px(b.y) - Math.round(Math.abs(Math.sin(time * 14)) * 2));
      const l = view.lures[i]!;
      const ls = this.lureSprites[i]!;
      ls.visible = l.alive;
      if (l.alive) {
        ls.position.set(px(l.x), px(l.y));
        ls.alpha = l.expiresAt - t < 1 ? (Math.floor(time * 10) % 2 ? 0.4 : 0.9) : 0.9;
      }
    }
  }

  spawnFloater(xm: number, ym: number, msg: string, color: number = 0xffffff, duration: number = 0.9): void {
    const text = new PixelText(this.font, msg, color, 'center');
    text.position.set(px(xm), px(ym) - 16);
    this.floaterLayer.addChild(text);
    this.floaters.push({
      text,
      xm,
      ym,
      offsetY: 0,
      life: duration,
      maxLife: duration,
    });
  }

  updateFloaters(dt: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life -= dt;
      if (f.life <= 0) {
        this.floaterLayer.removeChild(f.text);
        f.text.destroy();
        this.floaters.splice(i, 1);
        continue;
      }
      f.offsetY += dt * 22;
      f.text.position.set(px(f.xm), px(f.ym) - 16 - f.offsetY);
      f.text.alpha = f.life < 0.25 ? f.life / 0.25 : 1;
    }
  }
}
