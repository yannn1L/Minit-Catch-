export type Handler<T> = (event: T) => void;

/** Minimal typed pub/sub. Handlers run synchronously in subscription order. */
export class EventBus<T> {
  private handlers: Handler<T>[] = [];

  on(handler: Handler<T>): () => void {
    this.handlers.push(handler);
    return () => {
      const i = this.handlers.indexOf(handler);
      if (i >= 0) this.handlers.splice(i, 1);
    };
  }

  emit(event: T): void {
    const hs = this.handlers;
    for (let i = 0; i < hs.length; i++) hs[i]!(event);
  }

  clear(): void {
    this.handlers.length = 0;
  }
}
