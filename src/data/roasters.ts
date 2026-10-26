import { abilityId, roasterId, spriteId } from '../core/ids.ts';
import type { Registry } from '../core/Registry.ts';
import type { RoasterDef, RoasterStats } from '../shared/types.ts';
import type { RoasterId } from '../core/ids.ts';

const stats = (moveSpeed: number, pickupRadius: number, mass: number): RoasterStats => ({ moveSpeed, pickupRadius, carrySlots: 1, mass });

export const ROASTER_DEFS: readonly RoasterDef[] = [
  {
    id: roasterId('boomer'),
    name: 'Boomer',
    role: 'BOMBER',
    description: 'PLANTS TIMED BOMBS THAT STUN',
    ability: abilityId('bomber'),
    stats: stats(4.5, 1.1, 1.0),
    sprite: spriteId('roaster_boomer'),
    colors: { primary: 0xd1495b, accent: 0xedae49 },
  },
  {
    id: roasterId('netta'),
    name: 'Netta',
    role: 'NETTER',
    description: 'CASTS NET TO IMMOBILIZE FOES',
    ability: abilityId('netter'),
    stats: stats(4.6, 1.1, 0.9),
    sprite: spriteId('roaster_netta'),
    colors: { primary: 0x00798c, accent: 0x66a182 },
  },
  {
    id: roasterId('dash'),
    name: 'Dash',
    role: 'SPRINTER',
    description: 'DASHES FORWARD WITH SHIELD',
    ability: abilityId('sprinter'),
    stats: stats(4.55, 1.0, 0.8),
    sprite: spriteId('roaster_dash'),
    colors: { primary: 0xf4d35e, accent: 0xee6c4d },
  },
  {
    id: roasterId('magna'),
    name: 'Magna',
    role: 'MAGNETIZER',
    description: 'PULLS NEARBY FREE CHICKENS',
    ability: abilityId('magnetizer'),
    stats: stats(4.4, 1.1, 1.0),
    sprite: spriteId('roaster_magna'),
    colors: { primary: 0x7b2cbf, accent: 0xc77dff },
  },
  {
    id: roasterId('guard'),
    name: 'Guard',
    role: 'GUARDIAN',
    description: 'SHIELDS SELF AGAINST ATTACKS',
    ability: abilityId('guardian'),
    stats: stats(4.6, 1.1, 1.3),
    sprite: spriteId('roaster_guard'),
    colors: { primary: 0x3d5a80, accent: 0x98c1d9 },
  },
  {
    id: roasterId('trix'),
    name: 'Trix',
    role: 'TRICKSTER',
    description: 'DROPS A DECOY TO CONFUSE FOES',
    ability: abilityId('trickster'),
    stats: stats(4.7, 1.1, 0.8),
    sprite: spriteId('roaster_trix'),
    colors: { primary: 0x2a9d8f, accent: 0xe9c46a },
  },
  {
    id: roasterId('sabo'),
    name: 'Sabo',
    role: 'SABOTEUR',
    description: 'TEMPORARILY LOCKS ENEMY COOPS',
    ability: abilityId('saboteur'),
    stats: stats(4.5, 1.1, 1.0),
    sprite: spriteId('roaster_sabo'),
    colors: { primary: 0x495057, accent: 0xff6b6b },
  },
  {
    id: roasterId('tank'),
    name: 'Tank',
    role: 'HEAVY',
    description: 'SLAM KNOCKBACK ON NEARBY FOES',
    ability: abilityId('heavy'),
    stats: stats(4.7, 1.2, 2.0),
    sprite: spriteId('roaster_tank'),
    colors: { primary: 0xbc6c25, accent: 0xfefae0 },
  },
];

export function registerRoasters(reg: Registry<RoasterId, RoasterDef>): void {
  for (const d of ROASTER_DEFS) reg.register(d.id, d);
}
