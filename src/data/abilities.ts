import { abilityId, type AbilityId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { AbilityStrategy } from '../domain/strategies/ability.ts';
import {
  createBomber, createGuardian, createHeavy, createMagnetizer, createNetter, createSaboteur, createSprinter, createTrickster,
} from '../domain/strategies/abilities.ts';

export interface AbilityDef {
  readonly id: AbilityId;
  readonly role: string;
  readonly label: string;
  /** Longest disable (stun) this ability can apply, seconds (balance rule: <= 1.2). */
  readonly maxStunSec: number;
  /** Counters stun/drop (balance rule: at least 2 abilities do). */
  readonly countersDisable: boolean;
  readonly make: () => AbilityStrategy;
}

const id = abilityId;

// Durations/ranges in seconds/meters straight from the GDD ability table.
export const ABILITY_DEFS: readonly AbilityDef[] = [
  { id: id('bomber'), role: 'Disruptor', label: 'BOMB', maxStunSec: 0.9, countersDisable: false,
    make: () => createBomber(id('bomber'), { cooldown: 7, stunSec: 0.9, radius: 2.5, range: 7, fuse: 0.45 }) },
  { id: id('netter'), role: 'Controller', label: 'NET', maxStunSec: 0, countersDisable: false,
    make: () => createNetter(id('netter'), { cooldown: 6, rootSec: 1.4, range: 5.5, halfAngleDeg: 35 }) },
  { id: id('sprinter'), role: 'Catcher', label: 'DASH', maxStunSec: 0, countersDisable: true,
    make: () => createSprinter(id('sprinter'), { cooldown: 6, dashDist: 6, dashSpeed: 30, buffSec: 1.2, buffMult: 1.2, minTravel: 4.5 }) },
  { id: id('magnetizer'), role: 'Controller', label: 'MAGNET', maxStunSec: 0, countersDisable: false,
    make: () => createMagnetizer(id('magnetizer'), { cooldown: 9, radius: 4, pullSec: 0.9, minChickens: 3 }) },
  { id: id('guardian'), role: 'Support', label: 'SHIELD', maxStunSec: 0, countersDisable: true,
    make: () => createGuardian(id('guardian'), { cooldown: 9, shieldSec: 2, threatRadius: 5 }) },
  { id: id('trickster'), role: 'Trickster', label: 'DECOY', maxStunSec: 0, countersDisable: false,
    make: () => createTrickster(id('trickster'), { cooldown: 8, lureSec: 4, distance: 3, baitRange: 9 }) },
  { id: id('saboteur'), role: 'Disruptor', label: 'LOCK', maxStunSec: 0, countersDisable: false,
    make: () => createSaboteur(id('saboteur'), { cooldown: 9, lockSec: 2, threatRadius: 9 }) },
  { id: id('heavy'), role: 'Bruiser', label: 'SLAM', maxStunSec: 0, countersDisable: false,
    make: () => createHeavy(id('heavy'), { cooldown: 7, radius: 2.4, knock: 14 }) },
];

export const ABILITY_DEF_BY_ID: ReadonlyMap<AbilityId, AbilityDef> = new Map(
  ABILITY_DEFS.map((d) => [d.id, d]),
);

export function getAbilityDef(id: AbilityId): AbilityDef | undefined {
  return ABILITY_DEF_BY_ID.get(id);
}

export function registerAbilities(reg: Registry<AbilityId, AbilityStrategy>): void {
  for (const d of ABILITY_DEFS) reg.register(d.id, d.make());
}

