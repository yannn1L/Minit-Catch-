/** Generic type-safe id -> definition map. */
export class Registry<K extends string, V> {
  readonly name: string;
  private readonly map = new Map<K, V>();
  private cache: readonly V[] | null = null;

  constructor(name: string) {
    this.name = name;
  }

  register(id: K, value: V): this {
    if (this.map.has(id)) throw new Error(`[${this.name}] duplicate id "${id}"`);
    this.map.set(id, value);
    this.cache = null;
    return this;
  }

  get(id: K): V {
    const v = this.map.get(id);
    if (v === undefined) {
      throw new Error(`[${this.name}] unknown id "${id}". Known: ${[...this.map.keys()].join(', ') || '(none)'}`);
    }
    return v;
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
}
