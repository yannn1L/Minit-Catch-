import type { Container } from 'pixi.js';
import type { Scene } from './Scene.ts';

/** One active scene at a time; forwards resize/keys. Transitions: Loading->Editor->Simulation->(Editor|Simulation replay). */
export class SceneManager {
  private current: Scene | null = null;
  private w = 1;
  private h = 1;
  private readonly stage: Container;

  private readonly onKeyDown = (e: KeyboardEvent) => this.key(e, true);
  private readonly onKeyUp = (e: KeyboardEvent) => this.key(e, false);

  constructor(stage: Container) {
    this.stage = stage;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.current?.exit();
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    this.current?.onKey(e, down);
  }

  goto(next: Scene): void {
    if (this.current !== null) {
      this.current.exit();
      this.stage.removeChild(this.current.root);
      this.current.root.destroy({ children: true });
    }
    this.current = next;
    this.stage.addChild(next.root);
    next.resize(this.w, this.h);
    next.enter();
  }

  update(dt: number): void {
    this.current?.update(Math.min(dt, 0.1));
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.current?.resize(w, h);
  }
}
