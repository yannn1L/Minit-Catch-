import type { AiStrategy } from './ai.ts';
import { hybridAi } from './hybridAi.ts';

/**
 * Legacy utility AI facade, powered by the modular Hybrid AI strategy engine.
 * Retained for backwards compatibility across existing consumers and tests.
 */
export const utilityAi: AiStrategy = hybridAi;
