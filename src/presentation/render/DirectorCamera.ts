import type { SimView } from '../../sim/Simulation.ts';

export interface CameraState {
  x: number; // world meters
  y: number;
  zoom: number; // integer => pixel-perfect scaling
}

export interface CameraStrategy {
  update(view: SimView, dt: number, cam: CameraState, baseZoom: number): void;
}

/** Auto-focuses on the action cluster; integer zoom changes are debounced to avoid pumping. */
export class DirectorCamera implements CameraStrategy {
  private wantZoom = 0;
  private wantSince = 0;
  private clock = 0;
  targetRoasterSlot: number | null = null;
  forcedZoom: number | null = null;

  update(view: SimView, dt: number, cam: CameraState, baseZoom: number): void {
    this.clock += dt;

    if (this.targetRoasterSlot !== null) {
      const r = view.roasters.find((x) => x.slot === this.targetRoasterSlot);
      if (r) {
        const tx = r.x;
        const ty = r.y;
        cam.zoom = this.forcedZoom ? this.forcedZoom : Math.min(8, baseZoom + 1);
        const k = 1 - Math.exp(-4.5 * dt);
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        return;
      }
      this.targetRoasterSlot = null;
    }

    let sx = 0, sy = 0, sw = 0;
    for (const r of view.roasters) {
      let w = 1;
      if (r.state === 'carry') w += 1.5;
      if (r.state === 'stun') w += 2.5;
      if (view.time < r.shieldUntil || view.time < r.buffUntil) w += 1.5;
      if (r.channelKind !== 0) w += 1;
      sx += r.x * w; sy += r.y * w; sw += w;
    }
    const cx = sx / (sw || 1);
    const cy = sy / (sw || 1);
    let spread = 0;
    for (const r of view.roasters) spread = Math.max(spread, Math.hypot(r.x - cx, r.y - cy));
    const desired = this.forcedZoom ? this.forcedZoom : spread < view.arena.radius * 0.3 ? baseZoom + 1 : baseZoom;
    if (desired !== this.wantZoom) { this.wantZoom = desired; this.wantSince = this.clock; }
    if (this.clock - this.wantSince > 0.8 || cam.zoom === 0) cam.zoom = this.wantZoom;
    const k = 1 - Math.exp(-2.5 * dt);
    const lim = view.arena.radius * 0.6;
    const tx = Math.max(-lim, Math.min(lim, cx));
    const ty = Math.max(-lim, Math.min(lim, cy));
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }
}

/** Overview: centered, base zoom. Used for the results beat and as the director-off default before panning. */
export class OverviewCamera implements CameraStrategy {
  update(_view: SimView, dt: number, cam: CameraState, baseZoom: number): void {
    const k = 1 - Math.exp(-4 * dt);
    cam.x += (0 - cam.x) * k;
    cam.y += (0 - cam.y) * k;
    cam.zoom = baseZoom;
  }
}
