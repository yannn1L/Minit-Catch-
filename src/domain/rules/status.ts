import { MAX_STUN_SEC } from './constants.ts';
import type { Roaster } from '../entities/entities.ts';

export const isShielded = (r: Roaster, now: number): boolean => now < r.shieldUntil;
export const isStunned = (r: Roaster, now: number): boolean => now < r.stunUntil;
export const isRooted = (r: Roaster, now: number): boolean => now < r.rootUntil;

/** Stun never exceeds MAX_STUN_SEC remaining (balance rule: max stun ~1.2s). Returns applied remaining time. */
export function applyStunTimer(r: Roaster, now: number, seconds: number): number {
  const until = Math.min(now + MAX_STUN_SEC, Math.max(r.stunUntil, now + seconds));
  r.stunUntil = until;
  return until - now;
}

/** Keeps roaster.state consistent with its timers/carry slot. */
export function refreshState(r: Roaster, now: number): void {
  r.state = now < r.stunUntil ? 'stun' : r.carried >= 0 ? 'carry' : 'idle';
}
