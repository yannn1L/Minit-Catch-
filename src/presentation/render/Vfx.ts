import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import { PPM } from './ArenaRenderer.ts';

interface Live { p: Particle; vx: number; vy: number; life: number; max: number; drag: number }

/** Pooled particle VFX inside one ParticleContainer (single draw call). */
export class Vfx {
  readonly layer: ParticleContainer;
  private readonly live: Live[] = [];
  private readonly free: Particle[] = [];

  constructor(atlas: Texture) {
    this.layer = new ParticleContainer({
      texture: atlas,
      dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false },
    });
  }

  /** Radial burst at world meters. Speeds in px/s. */
  burst(xm: number, ym: number, tex: Texture, count: number, tint: number, speed: number, life: number, scale = 1, drag = 3): void {
    for (let i = 0; i < count && this.live.length < 400; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 2) * 0.4;
      const s = speed * (0.6 + 0.4 * ((i * 7) % 5) / 4); // deterministic spread; vfx never touches sim RNG
      let p = this.free.pop();
      if (p === undefined) p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 });
      p.texture = tex;
      p.x = Math.round(xm * PPM);
      p.y = Math.round(ym * PPM);
      p.scaleX = scale;
      p.scaleY = scale;
      p.tint = tint;
      p.alpha = 1;
      this.layer.addParticle(p);
      this.live.push({ p, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, drag });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i]!;
      l.life -= dt;
      if (l.life <= 0) {
        this.layer.removeParticle(l.p);
        this.free.push(l.p);
        this.live[i] = this.live[this.live.length - 1]!;
        this.live.pop();
        continue;
      }
      const damp = Math.exp(-l.drag * dt);
      l.vx *= damp;
      l.vy *= damp;
      l.p.x = Math.round(l.p.x + l.vx * dt);
      l.p.y = Math.round(l.p.y + l.vy * dt);
      l.p.alpha = Math.min(1, (l.life / l.max) * 1.5);
    }
  }

  clear(): void {
    for (const l of this.live) { this.layer.removeParticle(l.p); this.free.push(l.p); }
    this.live.length = 0;
  }
}
