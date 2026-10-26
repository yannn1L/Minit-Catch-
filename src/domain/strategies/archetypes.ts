/**
 * Role archetypes and behavioural profile weights for the Hybrid AI strategy.
 * Decouples roaster playstyles into data-driven configuration.
 */

export interface AiProfile {
  readonly role: string;
  /** Multiplier on squared distance to free chickens (lower = higher chase priority). */
  readonly chaseBias: number;
  /** Multiplier on decoy lure appeal (lower = more easily distracted by decoys). */
  readonly lureAttraction: number;
  /** Whether the roaster prioritizes intercepting opponents who are carrying chickens. */
  readonly interceptCarriers: boolean;
  /** How close to an enemy coop the roaster is willing to venture (multiplier on ENEMY_AREA_RADIUS). */
  readonly enemyAreaTolerance: number;
  /** Loiter radius around friendly coop when locked. */
  readonly lockLoiterRadius: number;
}

export const ROLE_ARCHETYPES: Readonly<Record<string, AiProfile>> = {
  Disruptor: {
    role: 'Disruptor',
    chaseBias: 1.0,
    lureAttraction: 0.9,
    interceptCarriers: true,
    enemyAreaTolerance: 1.1,
    lockLoiterRadius: 2.8,
  },
  Controller: {
    role: 'Controller',
    chaseBias: 0.95,
    lureAttraction: 0.85,
    interceptCarriers: true,
    enemyAreaTolerance: 1.0,
    lockLoiterRadius: 2.6,
  },
  Catcher: {
    role: 'Catcher',
    chaseBias: 0.85,
    lureAttraction: 0.8,
    interceptCarriers: false,
    enemyAreaTolerance: 0.9,
    lockLoiterRadius: 2.4,
  },
  Support: {
    role: 'Support',
    chaseBias: 1.0,
    lureAttraction: 0.75,
    interceptCarriers: false,
    enemyAreaTolerance: 0.85,
    lockLoiterRadius: 2.2,
  },
  Trickster: {
    role: 'Trickster',
    chaseBias: 1.05,
    lureAttraction: 0.6,
    interceptCarriers: false,
    enemyAreaTolerance: 1.0,
    lockLoiterRadius: 3.0,
  },
  Bruiser: {
    role: 'Bruiser',
    chaseBias: 1.0,
    lureAttraction: 0.95,
    interceptCarriers: true,
    enemyAreaTolerance: 1.05,
    lockLoiterRadius: 2.5,
  },
  Speedster: {
    role: 'Speedster',
    chaseBias: 0.8,
    lureAttraction: 0.8,
    interceptCarriers: false,
    enemyAreaTolerance: 0.9,
    lockLoiterRadius: 2.4,
  },
  Default: {
    role: 'Default',
    chaseBias: 1.0,
    lureAttraction: 0.8,
    interceptCarriers: false,
    enemyAreaTolerance: 1.0,
    lockLoiterRadius: 2.6,
  },
};

export function getAiProfile(role?: string): AiProfile {
  if (!role) return ROLE_ARCHETYPES.Default!;
  return ROLE_ARCHETYPES[role] ?? ROLE_ARCHETYPES.Default!;
}
