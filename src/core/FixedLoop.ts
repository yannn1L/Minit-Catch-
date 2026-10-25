/** Fixed-step accumulator: while accum >= TICK step(); caller renders with the returned alpha. */
export class FixedLoop {
  readonly tickSec: number;
  readonly maxSteps: number;
  private accum = 0;

  constructor(tickSec: number, maxSteps = 8) {
    this.tickSec = tickSec;
    this.maxSteps = maxSteps;
  }

  reset(): void {
    this.accum = 0;
  }

  /** `step` returns false to halt the loop (e.g. match ended). Returns interpolation alpha in [0,1]. */
  advance(frameDt: number, step: () => boolean): number {
    this.accum += frameDt;
    let n = 0;
    while (this.accum >= this.tickSec && n < this.maxSteps) {
      this.accum -= this.tickSec;
      n++;
      if (!step()) {
        this.accum = 0;
        return 1;
      }
    }
    if (n >= this.maxSteps && this.accum > this.tickSec) this.accum = this.tickSec; // drop backlog (spiral of death)
    return this.accum / this.tickSec;
  }
}
