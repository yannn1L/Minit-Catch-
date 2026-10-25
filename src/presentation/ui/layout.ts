/** Integer UI scale so virtual UI pixels stay crisp; virtual height >= ~180 px. */
export function uiScaleFor(w: number, h: number): number {
  return Math.max(1, Math.floor(Math.min(w, h) / 180));
}
export interface Virtual { scale: number; w: number; h: number; ox: number; oy: number }
export function virtualFor(w: number, h: number): Virtual {
  const scale = uiScaleFor(w, h);
  const vw = Math.floor(w / scale);
  const vh = Math.floor(h / scale);
  return { scale, w: vw, h: vh, ox: Math.floor((w - vw * scale) / 2), oy: Math.floor((h - vh * scale) / 2) };
}
