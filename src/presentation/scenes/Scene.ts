import type { Container } from 'pixi.js';

export interface Scene {
  readonly root: Container;
  enter(): void;
  exit(): void;
  /** dt in real seconds (clamped by the manager). */
  update(dt: number): void;
  /** Canvas size in physical pixels. */
  resize(w: number, h: number): void;
  onKey(e: KeyboardEvent, down: boolean): void;
}
