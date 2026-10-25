import type { ArenaId, RoasterId } from '../../core/ids.ts';
import type { MatchConfig } from '../../shared/types.ts';
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from './constants.ts';

export interface ValidationRegistries {
  readonly roasters: { has(id: RoasterId): boolean };
  readonly arenas: { has(id: ArenaId): boolean; get(id: ArenaId): { supports(participants: number): boolean } };
}

/** Returns human-readable errors; empty array means valid. */
export function validateMatchConfig(cfg: MatchConfig, regs: ValidationRegistries): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(cfg.seed) || cfg.seed < 1 || cfg.seed > 0xffffffff) errs.push(`seed must be a non-zero 32-bit integer (got ${cfg.seed})`);
  if (!Number.isInteger(cfg.participants) || cfg.participants < MIN_PARTICIPANTS || cfg.participants > MAX_PARTICIPANTS) {
    errs.push(`participants must be an integer in ${MIN_PARTICIPANTS}..${MAX_PARTICIPANTS} (got ${cfg.participants})`);
  }
  if (cfg.participants !== cfg.roasterIds.length) errs.push(`participants (${cfg.participants}) !== roasterIds.length (${cfg.roasterIds.length})`);
  for (const id of cfg.roasterIds) if (!regs.roasters.has(id)) errs.push(`unknown roaster "${id}"`);
  if (!regs.arenas.has(cfg.arenaId)) errs.push(`unknown arena "${cfg.arenaId}"`);
  else if (!regs.arenas.get(cfg.arenaId).supports(cfg.participants)) errs.push(`arena "${cfg.arenaId}" does not support ${cfg.participants} participants`);
  if (!(cfg.durationSec > 0)) errs.push('durationSec must be > 0');
  const cs = cfg.chickenSpawn;
  if (!(cs.initial >= 0) || !(cs.cap >= 1) || !(cs.interval >= 0.1)) errs.push('chickenSpawn requires initial>=0, cap>=1, interval>=0.1');
  if (cs.initial > cs.cap) errs.push('chickenSpawn.initial must be <= cap');
  if (!(cfg.observer.speed > 0)) errs.push('observer.speed must be > 0');
  return errs;
}
