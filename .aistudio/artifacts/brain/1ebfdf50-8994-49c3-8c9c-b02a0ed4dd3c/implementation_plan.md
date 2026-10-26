# Hybrid Strategy & Registry Pattern Architecture Overhaul

Extensible, modular, and robust architecture for **Minit Catch!** empowering effortless creation of custom roasters, abilities, and role-driven AI strategies while preserving 100% tick determinism and zero-allocation performance.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction has been aligned with your confirmed choices:
> - **Primary Priority**: Maximum extensibility for new custom roasters and abilities.
> - **AI Strategy Assignment**: Auto-assigned role archetypes derived from roaster abilities and character stats.

- **Confirmed Decision 1**: Custom Roaster and Ability extensibility will be strictly data-driven—developers can add roasters, abilities, and sprites without touching the core simulation engine.
- **Confirmed Decision 2**: AI behavior uses a **Hybrid Utility Strategy** where base spatial-awareness and target selection are modulated by distinct **Role Archetypes** (`Speedster`, `Disruptor`, `Defender`, `Harvester`, `Heavy`, `Saboteur`, `Trickster`).

---

## 1. Overview & Core Concept

### What It Does
Upgrades the Minit Catch simulation and presentation layers into a **clean Hybrid Strategy + Sealed Registry pattern**. Adding a new roaster or ability requires only registering definition objects in data modules; the engine automatically binds their role archetype, AI decision weights, ability execution pipeline, and sprite atlases with compile-time type safety and startup integrity validation.

### Target Developer & Spectator Value
- **Developer Experience**: Creating a new character or ability becomes a 5-minute task adhering to `howToMakeRoaster.md`, with zero fear of breaking simulation loops or memory limits.
- **Spectator Depth**: Roasters exhibit clear, distinctive combat and gathering personalities based on their role archetypes rather than a generic uniform chase loop.
- **Deterministic Robustness**: Sealed immutable registries prevent accidental runtime state mutations during tick execution.

---

## 2. Architecture & Pattern Design

### The Hybrid Strategy Pattern
In Minit Catch, a roaster's actions during each tick require three coordinated decisions:
1. **Movement / Navigation Intent**: Where to move, flee, or loiter.
2. **Target Evaluation**: Which chicken, lure, or enemy coop has maximum utility.
3. **Tactical Ability Execution**: When and where to deploy the active skill.

The **Hybrid Strategy** composes these concerns:
- **Base Spatial Utility AI**: Evaluates distance, coop proximity, and anti-camp corridors.
- **Archetype Modifiers (`AiProfile`)**: Weights target priority (e.g., Harvesters favor low-risk chickens; Disruptors favor enemy clusters; Defenders hover near their own coop).
- **Ability Strategy (`AbilityStrategy`)**: Governs cooldown gating, tactical aim, and area-of-effect execution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             REGISTRIES                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Roasters     │  │ Abilities    │  │ Arenas       │  │ AI Archetypes   │  │
│  │ (Definitions)│  │ (Strategies) │  │ (Layouts)    │  │ (Role Profiles) │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │ (sealed)        │ (sealed)        │ (sealed)          │ (sealed)  │
└─────────┼─────────────────┼─────────────────┼───────────────────┼───────────┘
          ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SIMULATION CONTEXT & ENTITIES                           │
│                                                                             │
│   Roaster [Slot i]                                                          │
│   ├── Stats (moveSpeed, mass, pickupRadius)                                 │
│   ├── Ability Strategy (canUse, use, cooldown)                              │
│   └── Hybrid AI Strategy (Role Profile + Scored Utility Evaluator)          │
│                                                                             │
│   Fixed 30Hz Loop ──► Spatial Hash ──► Ability System ──► Movement/Scores   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Architectural Changes

### 1. Robust Sealed Registry Pattern (`src/core/Registry.ts`)
- **Immutability & Sealing**: Add `.seal()` and `isSealed` guard to `Registry<K, V>`. Once `createRegistries()` completes at boot, registries are sealed to prevent accidental runtime mutations or memory leaks.
- **Graceful Querying (`tryGet`)**: Add `.tryGet(id: K): V | undefined` alongside `.get(id: K)` for safe lookups without uncaught exceptions during discovery.
- **Type-Safe Metadata & Enumeration**: Cache keys, values, and count for instant O(1) access.

### 2. Role Archetype Registry (`src/domain/strategies/archetypes.ts`)
Define formal combat & foraging role archetypes:
- `Harvester` (e.g. Magna): High priority on gathering, avoids enemy brawls.
- `Speedster` (e.g. Dash): Prioritizes distant isolated chickens, uses burst mobility.
- `Disruptor` (e.g. Boomer, Netta): Prioritizes interrupting enemy carriers and clumping enemies.
- `Defender` (e.g. Guard): Guards coop perimeter when ahead, protects carried chickens.
- `Brawler` (e.g. Tank): Punishes roasters in transit with ground slams.
- `Saboteur` (e.g. Sabo): Targets leading enemy coops to lock them down.

### 3. Modular Hybrid AI Strategy (`src/domain/strategies/hybridAi.ts`)
Refactor `utilityAi` into a composable hybrid evaluator:
- Reusable scratch buffers (`Int32Array`) to guarantee **zero object allocation** per tick.
- Role-specific scoring weights:
  - `chickenDistMultiplier`: Adjusts chase urgency.
  - `carrierInterceptWeight`: Urgency to intercept opponents carrying chickens.
  - `enemyTerritoryRiskPenalty`: Willingness to venture near enemy coops.
  - `abilityTriggerBias`: Willingness to cast abilities proactively vs defensively.

### 4. Self-Validating Extensibility Pipeline (`src/data/registries.ts`)
- Centralized dependency integrity verification in `createRegistries()`:
  - Validates that every registered `RoasterDef` references a valid `AbilityStrategy`.
  - Validates that every roaster references a valid `SpriteDef`.
  - Validates that every ability references an appropriate `AiProfile`.
  - Enforces invariant checks: cooldown > 0, roaster moveSpeed in 4.0–5.0 m/s range, max stun <= 1.2s.
- Automatic registration helper for custom roasters and abilities.

---

## 4. Verification & Testing Strategy

1. **Architecture Rule Enforcement**:
   - Verify `tests/architecture.test.ts` remains pristine (no imports of Pixi or non-deterministic APIs in `sim/` or `domain/`).
2. **100% Determinism Preservation**:
   - Verify `tests/determinism.test.ts` produces identical event-log hash across 100 runs with zero drift.
3. **Gameplay Balance Sweep**:
   - Verify `tests/balance.test.ts` passes (no single roaster wins > 38% across seed sweeps).
4. **Unit Invariants**:
   - Verify `tests/simulation.test.ts` passes all scoring, invariant, and spatial hash tests.
5. **Applet Compilation & Build**:
   - Run `lint_applet` and `compile_applet` to confirm zero TypeScript errors.
