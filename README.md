# Minit Catch!

Spectator auto-sim (Pixi.js v8, TypeScript strict ESM, Vite, ZzFX port). Zero assets: sprites, ground, font and audio are generated from code.

```bash
npm install
npm run dev            # play
npm run typecheck
npm test               # vitest (determinism x100, invariants, balance, architecture rules)
npm run test:determinism   # 1000-run event-log hash check
node scripts/headless.ts 100 8 open   # Node >= 22.18: headless balance sweep
```

## Controls (simulation)
Space pause - 1-4 speed (0.5/1/2/4x) - C director/free camera (free: WASD/arrows pan, +/- integer zoom) - R replay (re-simulates, verifies identical event-log hash) - Esc editor - M mute.

## Layout
`core/` rng, Registry, EventBus, FixedLoop - `data/` roasters, abilities, arenas, sprites, sounds (describe only) - `domain/` entities, strategies (Ability/Ai/Arena/Tiebreak), rules - `sim/` Simulation + systems (no pixi) - `presentation/` Pixi scenes, renderers, HUD, audio - `app/` main + GameContext.

Add a roaster/ability/arena = add a file in `data/` and register it; no system changes.

## Decisions (GDD gaps)
- 3 arenas shipped (open, obstacle, multi-spawn); `tight-corridor` deferred (needs grid pathfinding). Local steering with tangent detours handles circular pillars.
- A `SpawnSystem` runs right after `InputSystem` (the GDD order has no spawner).
- `TiebreakStrategy.resolve` returns the winning `Score`; `compare()` added so exact ties can trigger the 5 s overtime.
- Replay = deterministic re-simulation with the same config, hash-compared against the original log.
- Pixel-perfect: renderer resolution 1 at device pixels, integer camera zoom/UI scale, positions rounded to world pixels, nearest sampling.
- `ParticleContainer`/`Particle` (Pixi >= 8.4 API) is used for chickens and VFX.

## Verification status
Sim/domain/data layers were type-checked and run headless (invariants every tick, determinism, arena fairness, balance sweep). The Pixi presentation layer was type-checked only against a loose stub of `pixi.js` because the build sandbox had no network: run `npm install && npm run typecheck && npm run dev` first and report any Pixi API drift.
