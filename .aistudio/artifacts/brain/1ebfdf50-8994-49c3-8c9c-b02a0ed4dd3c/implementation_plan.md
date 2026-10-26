# Audio System Overhaul, Sound Sliders, and Settings Polish

## Title & Summary
This update streamlines the Editor Settings modal, introduces dedicated stepped volume controls (Global Master, SFX, Editor BGM, and Simulation BGM), adds a dedicated fast energetic 8-bit arcade battle theme for match simulation, overhauls sound effects into bright cartoony squishes with cheerful chime accents, and cleans up ability labels in the roster cards and data definitions.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences from Phase 1 clarification are confirmed and locked into the implementation architecture:

- **Confirmed Decision 1 (Match BGM)**: A fast, energetic 8-bit arcade battle theme with driving pulse and syncopated melodic hooks will be composed for `SimulationScene` using procedural ZzFX buffer synthesis, distinct from the calm groovy theme in `EditorScene`.
- **Confirmed Decision 2 (Volume Slider UI)**: Interactive horizontal step bars (`[-] [■■■■□□□□□□] [+] XX%`) rendered in pure Pixi pixel art with discrete 10% steps and responsive tap/click handling.
- **Confirmed Decision 3 (SFX Acoustic Profile)**: Bright cartoony squish and cheerful chime accents replacing raw noise/rough square waves (juicy pop on chicken pickup, triumphant major chime on coop deliver, cartoon boing/slam, crisp bouncy countdown, and rich bass rumble for explosions).
- **Confirmed Decision 4 (Settings Modal Cleanup)**: Redundant controls already present in the primary Editor view (Match Timer, Random Seed, Random Arena, and Camera Zoom) are cleanly removed from the Settings window.
- **Confirmed Decision 5 (Ability Label Deletion)**: Removed `label` from `AbilityDef` in `src/data/abilities.ts` and removed ability label text below names on roaster roster cards in `src/presentation/scenes/EditorScene.ts`.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **Settings Modal Streamlining**: Reduces visual clutter by purging duplicate toggles (timer, arena, seed, zoom) so the modal focuses purely on Display Options (Hint Bar, Bottom Touch Buttons) and Audio Mixing.
  2. **Multi-Channel Volume Architecture**: Upgrades `ZzfxPlayer` from a binary mute toggle to independent volume channels with persistent localStorage backing:
     - `master`: Global volume multiplier ($0.0 - 1.0$)
     - `sfx`: Sound effects multiplier ($0.0 - 1.0$)
     - `bgmEditor`: Menu/Editor music volume multiplier ($0.0 - 1.0$)
     - `bgmSim`: In-match simulation battle music volume multiplier ($0.0 - 1.0$)
  3. **Dual BGM Engine**: Seamless transition between the chill lounge BGM in the Editor and a fast-paced high-energy 150 BPM 8-bit battle theme when starting a match, automatically stopping or switching on scene transitions.
  4. **Juicy & Satisfying Sound FX**: Complete redesign of `SFX_DEFS` using frequency slides, harmonic sweeps, vibrato, and subtle delay to give each in-game action a delightful cartoon punch.
  5. **Clean Roaster Roster Grid**: Deletes the truncated ability subtitle from roaster cards in `EditorScene`, keeping character cards uncluttered with pixel art and character name, while rich ability details remain in the hover tooltip.

- **Target Audience / Persona**: Players and observers watching or spectating AI roaster chicken battles who need fine-tuned volume control for streaming or headphone listening, and desire an engaging retro arcade experience.
- **Key Value**: Crisp audiovisual hierarchy, immediate satisfying haptic/audio feedback, and simplified, non-redundant settings navigation.

---

## 2. User Experience & Visual Design

### A. Settings Modal Layout
The settings modal rendered in `EditorScene` features a compact pixel-art bordered container:
- **Header**: `AUDIO & SETTINGS` title in high-contrast text.
- **Audio Channels (Horizontal Steppers)**:
  - `MASTER`: `[-] [■■■■■■■■□□] [+] 80%`
  - `SFX`:    `[-] [■■■■■■■■■■] [+] 100%`
  - `EDITOR BGM`: `[-] [■■■■■■□□□□] [+] 60%`
  - `MATCH BGM`:  `[-] [■■■■■■■□□□] [+] 70%`
  - Tap `[-]` decreases volume by 10%; tap `[+]` increases volume by 10%; tap the bar directly jumps to proportional step. A mute toggle button (`MUTE ALL`) remains available at the bottom for quick silence.
- **Display Options**:
  - `HINT BAR: [VISIBLE / HIDDEN]`
  - `TOUCH CONTROLS: [VISIBLE / HIDDEN]`
- **Close Button**: `[X] CLOSE` at modal bottom and top corner.

### B. Roaster Cards in Editor Scene
- Card layout: Outer border (37x32px), inner background panel, roaster slot accent header line, centered 12x13 pixel-art animated sprite, and character name in bold caps.
- The previous dim ability label below the name is removed, providing breathing room and eliminating awkward text truncation.
- Hovering/tapping any card continues to show the dynamic tooltip with full role, description, and stats.

### C. Sound & Music Character
- **Pickup Sound**: Bouncy ascending bubble pop ($F_0=600 \to 1200\text{Hz}$) with resonant filter curve.
- **Deliver Sound**: Cheerful 3-note major arpeggio chime ($C_5 - E_5 - G_5$) that rings out crisply with decay.
- **Bomb Sound**: Punchy cartoon explosion with initial slap transient, deep bass decay, and no abrasive static fizz.
- **Net Sound**: Whimsical cartoon *whoosh-snag* pitch drop with harmonic undertone.
- **Dash Sound**: Crisp jet-dash wind sweep ($800 \to 1600\text{Hz}$).
- **Stun Sound**: Classic cartoon dizzy chirping wobble with tremolo.
- **Score/Lead Change**: Bright fanfare blip.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Audio Volume State Model (GainNode Hierarchy)**
  - *Chosen Approach*: Implement a structured Web Audio routing tree:
    `Oscillators / SFX Buffers` $\to$ `sfxGain` $\to$ `masterGain` $\to$ `destination`.
    `BGM Generators` $\to$ `bgmGain` (dynamically loaded with Editor or Sim volume) $\to$ `masterGain` $\to$ `destination`.
  - *Why*: Allows zero-latency real-time volume adjustment without restarting active loops or re-synthesizing sound buffers.
  - *Alternatives Considered*: Re-scaling sample array floats in software (too expensive, introduces stutter on volume change).

- **Decision 2: Scene-Aware BGM Lifecycle**
  - *Chosen Approach*: `ZzfxPlayer.playTrack('editor' | 'sim')` with smooth gain crossfade (150ms). When `SimulationScene.enter()` is called, it switches to `'sim'`. When exiting back to `EditorScene`, it seamlessly returns to `'editor'`.
  - *Why*: Prevents audio bleed or abrupt silence, ensuring consistent scene identity.
  - *Alternatives Considered*: Loading external MP3/OGG files (violates zero-asset self-contained constraint; ZzFX procedural audio keeps the entire app build ultra-lightweight and deterministic).

- **Decision 3: Removal of Redundant Controls from Settings Modal**
  - *Chosen Approach*: Remove Match Timer, Random Arena, Random Seed, and Camera Zoom from `renderSettingsModal`.
  - *Why*: These controls already exist as prominent primary interactive elements in `EditorScene` (Timer presets, Arena carousel with RND toggle, Seed input with RND toggle, and in-game camera zoom controls). Keeping them in Settings was redundant and cluttered the window.

---

## 4. Technical Architecture & Data Strategy

### System Audio & Scene Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AudioContext                           │
│                                                             │
│   ┌──────────────┐     ┌──────────────┐                     │
│   │  SFX Buffers │───▶ │   sfxGain    │───┐                 │
│   └──────────────┘     └──────────────┘   │                 │
│                                           │                 │
│   ┌──────────────┐     ┌──────────────┐   │   ┌──────────┐  │
│   │  Editor BGM  │───▶ │              │   ├──▶│  master  │──┼──▶ Destination
│   └──────────────┘     │   bgmGain    │───┘   │   Gain   │  │
│   ┌──────────────┐     │              │       └──────────┘  │
│   │  Sim BGM     │───▶ │              │                     │
│   └──────────────┘     └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │
            ┌──────────────────┴──────────────────┐
            │         ZzfxPlayer API              │
            │  - setMasterVolume(0..1)            │
            │  - setSfxVolume(0..1)               │
            │  - setEditorBgmVolume(0..1)         │
            │  - setSimBgmVolume(0..1)            │
            │  - playTrack('editor' | 'sim')      │
            │  - play(name, gain)                 │
            └─────────────────────────────────────┘
                               ▲
             ┌─────────────────┴─────────────────┐
             │                                   │
      ┌──────────────┐                   ┌───────────────┐
      │ EditorScene  │                   │SimulationScene│
      │ - Settings   │                   │ - Enter:      │
      │   Volume Bars│                   │   play('sim') │
      │ - Roster Grid│                   │ - Exit:       │
      │   (No Labels)│                   │   play('edit')│
      └──────────────┘                   └───────────────┘
```

### Component & State Mapping

| Component | Target File | State Mutation / Action |
|---|---|---|
| `ZzfxPlayer` | `src/presentation/audio/ZzfxPlayer.ts` | Multi-channel volume state (`master`, `sfx`, `bgmEditor`, `bgmSim`), localStorage persistence (`minitcatch.audio`), dual BGM sequencer (`editor` vs `sim`). |
| `Audio Definitions` | `src/data/sounds.ts` | Polished `SFX_DEFS` (cartoony squish, cheerful chime, crisp booms) + `BGM_SIM` track definition (150 BPM energetic battle theme). |
| `Ability Defs` | `src/data/abilities.ts` | Remove `label: string` property from `AbilityDef` interface and definitions in `ABILITY_DEFS`. |
| `EditorScene` | `src/presentation/scenes/EditorScene.ts` | Remove ability subtitle from roster cards; strip redundant controls from `renderSettingsModal`; render 4 step-slider volume rows with `[-]` and `[+]` buttons. |
| `SimulationScene` | `src/presentation/scenes/SimulationScene.ts` | Trigger `audio.playTrack('sim')` upon enter and restore `audio.playTrack('editor')` upon exit. |

---

## 5. Verification Plan

1. **Unit & Determinism Tests**: Run `npm test` to verify all 30 tests pass (simulation determinism and invariant checks remain 100% intact).
2. **TypeScript & Lint Validation**: Run `lint_applet` (`tsc --noEmit`) to ensure clean types across all components.
3. **Applet Compilation**: Run `compile_applet` to confirm the Vite production build compiles without bundle warnings.
4. **Interactive Verification**:
   - Verify Settings Modal opens and displays all four volume step-sliders cleanly.
   - Verify adjusting Master, SFX, Editor BGM, and Match BGM steps adjusts audio volume immediately and persists on reload.
   - Verify redundant options (timer, arena, seed, cam zoom) no longer appear in the Settings window.
   - Verify roster cards in Editor have clean layout without ability labels.
   - Verify transitioning from Editor into Match starts the energetic battle BGM, and exiting back returns to the Editor theme.
   - Verify all SFX (pickup, deliver, bomb, net, dash, stun, scoreUp) sound rich, juicy, and cartoonish.
