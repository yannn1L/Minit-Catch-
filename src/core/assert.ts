export class InvariantError extends Error {
  constructor(message: string) {
    super(`[invariant] ${message}`);
    this.name = 'InvariantError';
  }
}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new InvariantError(message);
}
