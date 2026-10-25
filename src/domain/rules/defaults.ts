import { arenaId, type RoasterId } from '../../core/ids.ts';
import type { MatchConfig } from '../../shared/types.ts';
import { DEFAULT_DURATION_SEC, defaultChickenSpawn } from './constants.ts';

/** Default preset (also what LoadingScene validates). Roster cycles through the available roasters. */
export function defaultMatchConfig(allRoasters: readonly RoasterId[], participants = 4, seed = 0xc0ffee): MatchConfig {
  const roasterIds: RoasterId[] = [];
  for (let i = 0; i < participants; i++) roasterIds.push(allRoasters[i % allRoasters.length]!);
  return {
    seed,
    participants,
    roasterIds,
    arenaId: arenaId('open'),
    durationSec: DEFAULT_DURATION_SEC,
    chickenSpawn: defaultChickenSpawn(participants),
    observer: { cameraDirector: true, speed: 1, zoom: 0, hideControls: false, hideHints: false, randomArena: false, randomSeed: false },
  };
}
