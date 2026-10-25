import type { Chicken } from '../domain/entities/entities.ts';

/** Uniform grid, counting-sort rebuild (no per-tick allocation). Indexes free chickens. */
export class SpatialHash {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly origin: number;
  private readonly start: Int32Array;
  private readonly items: Int32Array;
  private readonly cellOf: Int32Array;

  constructor(arenaRadius: number, cellSize: number, capacity: number) {
    this.cell = cellSize;
    this.origin = -(arenaRadius + 2);
    this.cols = Math.ceil((arenaRadius * 2 + 4) / cellSize) + 1;
    this.rows = this.cols;
    this.start = new Int32Array(this.cols * this.rows + 1);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
  }

  private idx(v: number, max: number): number {
    const i = Math.floor((v - this.origin) / this.cell);
    return i < 0 ? 0 : i >= max ? max - 1 : i;
  }

  rebuild(chickens: readonly Chicken[], count: number): void {
    const start = this.start;
    start.fill(0);
    for (let i = 0; i < count; i++) {
      const c = chickens[i]!;
      if (c.state !== 'free') {
        this.cellOf[i] = -1;
        continue;
      }
      const cell = this.idx(c.y, this.rows) * this.cols + this.idx(c.x, this.cols);
      this.cellOf[i] = cell;
      start[cell + 1]!++;
    }
    for (let i = 1; i < start.length; i++) start[i] = start[i]! + start[i - 1]!;
    // fill using a moving cursor per cell (reuse cellOf scan order => ids ascending within a cell)
    const cursor = this.cursor(start);
    for (let i = 0; i < count; i++) {
      const cell = this.cellOf[i]!;
      if (cell < 0) continue;
      this.items[cursor[cell]!++] = i;
    }
  }

  private cursorBuf: Int32Array | null = null;
  private cursor(start: Int32Array): Int32Array {
    const n = start.length - 1;
    const buf = (this.cursorBuf ??= new Int32Array(n));
    for (let i = 0; i < n; i++) buf[i] = start[i]!;
    return buf;
  }

  /** Writes ids of free chickens within `radius` of (x,y) into out (up to out.length). Uses live positions. */
  query(chickens: readonly Chicken[], x: number, y: number, radius: number, out: Int32Array): number {
    const x0 = this.idx(x - radius, this.cols);
    const x1 = this.idx(x + radius, this.cols);
    const y0 = this.idx(y - radius, this.rows);
    const y1 = this.idx(y + radius, this.rows);
    const r2 = radius * radius;
    let n = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = cy * this.cols + cx;
        const end = this.start[cell + 1]!;
        for (let k = this.start[cell]!; k < end; k++) {
          const id = this.items[k]!;
          const c = chickens[id]!;
          if (c.state !== 'free') continue;
          const dx = c.x - x;
          const dy = c.y - y;
          if (dx * dx + dy * dy <= r2) {
            if (n >= out.length) return n;
            out[n++] = id;
          }
        }
      }
    }
    return n;
  }
}
