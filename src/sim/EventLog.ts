import { EventBus } from '../core/EventBus.ts';
import type { SimEvent } from '../shared/types.ts';

/** Ground truth for replay, tests and presentation. push() during a tick, flush() once at the end. */
export class EventLog {
  readonly history: SimEvent[] = [];
  readonly bus = new EventBus<SimEvent>();
  private readonly pending: SimEvent[] = [];

  push(ev: SimEvent): void {
    this.pending.push(ev);
  }

  /** Moves pending events into history and notifies subscribers in order. */
  flush(): void {
    const p = this.pending;
    for (let i = 0; i < p.length; i++) {
      const ev = p[i]!;
      this.history.push(ev);
      this.bus.emit(ev);
    }
    p.length = 0;
  }
}

const round4 = (_k: string, v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);

/** FNV-1a over a canonical serialization (numbers quantized to 1e-4). */
export function hashEvents(events: readonly SimEvent[]): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < events.length; i++) {
    const s = JSON.stringify(events[i], round4);
    for (let j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 10;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
