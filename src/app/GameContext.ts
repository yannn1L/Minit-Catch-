import type { Application } from 'pixi.js';
import type { Registries } from '../data/registries.ts';
import type { ZzfxPlayer } from '../presentation/audio/ZzfxPlayer.ts';
import type { SceneManager } from '../presentation/scenes/SceneManager.ts';
import type { SpriteFactory } from '../presentation/sprites/SpriteFactory.ts';
import type { PixelFont } from '../presentation/ui/PixelFont.ts';
import type { MatchConfig } from '../shared/types.ts';

/** Available before loading finishes. */
export interface Bootstrap {
  readonly app: Application;
  readonly font: PixelFont;
  readonly scenes: SceneManager;
}

/** LoadingScene output: everything the other scenes need. */
export interface GameContext extends Bootstrap {
  readonly regs: Registries;
  readonly sprites: SpriteFactory;
  readonly audio: ZzfxPlayer;
  /** Editor's working config; survives Simulation -> Editor round trips. */
  config: MatchConfig;
}
