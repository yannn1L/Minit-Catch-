import { OVERTIME_SEC, TICK_RATE } from '../../domain/rules/constants.ts';
import { leadingSlots } from '../../domain/rules/scoring.ts';
import type { Simulation } from '../Simulation.ts';

const leaders: number[] = [];

function findMvp(sim: Simulation, team: 0 | 1): number {
  let bestSlot = -1;
  let maxScore = -1;
  for (let i = 0; i < sim.roasters.length; i++) {
    if (sim.teamOf(i) !== team) continue;
    const sc = sim.roasters[i]!.delivered;
    if (sc > maxScore) {
      maxScore = sc;
      bestSlot = i;
    }
  }
  return bestSlot >= 0 ? bestSlot : (team === 0 ? 0 : Math.floor(sim.roasters.length / 2));
}

/** Final scoring: points = chickens in coop at the end; ties -> carried -> fastest -> 5 s sudden-death overtime. */
export function scoringSystem(sim: Simulation): void {
  if (sim.phase === 'ended') return;

  if (sim.isTagTeam) {
    const ts = sim.teamScores();
    if (sim.phase === 'active') {
      if (sim.tick < sim.endTick) return;
      if (ts[0] > ts[1]) {
        sim.finish(findMvp(sim, 0), false, false);
        return;
      }
      if (ts[1] > ts[0]) {
        sim.finish(findMvp(sim, 1), false, false);
        return;
      }
      // Dead tie: enter sudden death overtime
      sim.phase = 'overtime';
      sim.overtimeEndTick = sim.tick + OVERTIME_SEC * TICK_RATE;
      sim.tiedPoints = ts[0];
      sim.emit({ t: 'overtime', tick: sim.tick });
      return;
    }
    // Tag team overtime: first team to score wins
    if (ts[0] > sim.tiedPoints) {
      sim.finish(findMvp(sim, 0), false, true);
    } else if (ts[1] > sim.tiedPoints) {
      sim.finish(findMvp(sim, 1), false, true);
    } else if (sim.tick >= sim.overtimeEndTick) {
      sim.finish(0, true, true);
    }
    return;
  }

  if (sim.phase === 'active') {
    if (sim.tick < sim.endTick) return;
    const board = sim.scoreboard();
    leadingSlots(board, sim.tiebreak, leaders);
    if (leaders.length === 1) {
      sim.finish(leaders[0]!, false, false);
      return;
    }
    sim.phase = 'overtime';
    sim.overtimeEndTick = sim.tick + OVERTIME_SEC * TICK_RATE;
    sim.tiedSlots = leaders.slice();
    sim.tiedPoints = board[leaders[0]!]!.points;
    sim.emit({ t: 'overtime', tick: sim.tick });
    return;
  }
  // overtime: first tied participant to bank a chicken wins (best tiebreak if several in one tick)
  let winner = -1;
  const board = sim.scoreboard();
  for (const slot of sim.tiedSlots) {
    if (sim.coops[slot]!.score <= sim.tiedPoints) continue;
    if (winner < 0 || sim.tiebreak.compare(board[slot]!, board[winner]!) > 0) winner = slot;
  }
  if (winner >= 0) {
    sim.finish(winner, false, true);
  } else if (sim.tick >= sim.overtimeEndTick) {
    sim.finish(sim.tiedSlots[0]!, true, true); // still dead even: declared draw, lowest slot listed
  }
}
