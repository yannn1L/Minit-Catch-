/** Generic type-safe id -> definition map. */
export class Registry<K extends string, V> {
  readonly name: string;
  private readonly map = new Map<K, V>();
  private cache: readonly V[] | null = null;

  private sealed = false;
  private entriesCache: readonly (readonly [K, V])[] | null = null;

  constructor(name: string) {
    this.name = name;
  }

  get isSealed(): boolean {
    return this.sealed;
  }

  seal(): this {
    this.sealed = true;
    return this;
  }

  register(id: K, value: V): this {
    if (this.sealed) throw new Error(`[${this.name}] cannot register "${id}": registry is sealed and immutable`);
    if (this.map.has(id)) throw new Error(`[${this.name}] duplicate id "${id}"`);
    this.map.set(id, value);
    this.cache = null;
    this.entriesCache = null;
    return this;
  }

  get(id: K): V {
    const v = this.map.get(id);
    if (v === undefined) {
      throw new Error(`[${this.name}] unknown id "${id}". Known: ${[...this.map.keys()].join(', ') || '(none)'}`);
    }
    return v;
  }

  tryGet(id: K): V | undefined {
    return this.map.get(id);
  }

  has(id: K): boolean {
    return this.map.has(id);
  }

  all(): readonly V[] {
    return (this.cache ??= [...this.map.values()]);
  }

  ids(): readonly K[] {
    return [...this.map.keys()];
  }

  entries(): readonly (readonly [K, V])[] {
    return (this.entriesCache ??= [...this.map.entries()]);
  }

  get size(): number {
    return this.map.size;
  }
}
