import type { AiIntent, Roaster } from '../entities/entities.ts';
import type { SimContext } from './context.ts';

export interface AiStrategy {
  /** Fills and returns self.intent (no allocation). */
  think(self: Roaster, ctx: SimContext, dt: number): AiIntent;
}
