import { Application, TextureStyle, type Ticker } from 'pixi.js';
import { LoadingScene } from '../presentation/scenes/LoadingScene.ts';
import { SceneManager } from '../presentation/scenes/SceneManager.ts';
import { PixelFont } from '../presentation/ui/PixelFont.ts';

// Pixel-perfect: nearest sampling everywhere, 1:1 device pixels (no resolution scaling), integer zoom in scenes.
TextureStyle.defaultOptions.scaleMode = 'nearest';

const dpr = (): number => window.devicePixelRatio || 1;
const physical = (): { w: number; h: number } => ({ w: Math.max(1, Math.floor(window.innerWidth * dpr())), h: Math.max(1, Math.floor(window.innerHeight * dpr())) });

/** WebGPU first, WebGL fallback (GDD gracefulDegrade). */
async function createApp(): Promise<Application> {
  const { w, h } = physical();
  let lastError: unknown;
  for (const preference of ['webgpu', 'webgl'] as const) {
    const app = new Application();
    try {
      await app.init({ preference, width: w, height: h, resolution: 1, autoDensity: false, antialias: false, background: 0x10131c, roundPixels: true });
      return app;
    } catch (e) {
      lastError = e;
      console.warn(`[minitcatch] ${preference} init failed, trying next backend`, e);
    }
  }
  throw new Error(`No usable renderer: ${String(lastError)}`);
}

export interface MinitCatchInstance {
  app: Application;
  scenes: SceneManager;
  destroy: () => void;
}

export async function startMinitCatch(container: HTMLElement = document.body): Promise<MinitCatchInstance> {
  const app = await createApp();
  app.canvas.tabIndex = 0;
  container.appendChild(app.canvas);
  const font = new PixelFont();
  const scenes = new SceneManager(app.stage);

  function fit(): void {
    const cw = container.clientWidth || window.innerWidth;
    const ch = container.clientHeight || window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(cw * pixelRatio));
    const h = Math.max(1, Math.floor(ch * pixelRatio));
    app.renderer.resize(w, h);
    app.canvas.style.width = `${cw}px`;
    app.canvas.style.height = `${ch}px`;
    scenes.resize(w, h);
  }

  window.addEventListener('resize', fit);
  const onOrientation = (): void => {
    setTimeout(fit, 80);
    setTimeout(fit, 200);
  };
  window.addEventListener('orientationchange', onOrientation);
  const tickerFn = (t: Ticker) => scenes.update(t.deltaMS / 1000);
  app.ticker.add(tickerFn);
  fit();
  scenes.goto(new LoadingScene({ app, font, scenes }));

  return {
    app,
    scenes,
    destroy: () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', onOrientation);
      app.ticker.remove(tickerFn);
      scenes.destroy();
      try {
        if (app.canvas && app.canvas.parentNode === container) {
          container.removeChild(app.canvas);
        }
        app.destroy(true, { children: true });
      } catch (err) {
        console.warn('[minitcatch] app destroy warning:', err);
      }
    },
  };
}

// Standalone fallback if index.html is pointed directly to main.ts without React root
if (typeof document !== 'undefined' && !document.getElementById('root')) {
  void startMinitCatch(document.body);
}
