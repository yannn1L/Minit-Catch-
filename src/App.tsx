import { useEffect, useRef } from 'react';
import { startMinitCatch, type MinitCatchInstance } from './app/main.ts';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: MinitCatchInstance | undefined;
    let isMounted = true;

    if (containerRef.current) {
      startMinitCatch(containerRef.current)
        .then((inst) => {
          if (!isMounted) {
            inst.destroy();
          } else {
            instance = inst;
          }
        })
        .catch((err) => {
          console.error('[Minit Catch] Failed to initialize game:', err);
        });
    }

    return () => {
      isMounted = false;
      instance?.destroy();
    };
  }, []);

  return (
    <main
      className="w-screen h-screen overflow-hidden bg-[#0d1018] flex items-center justify-center select-none"
      aria-label="Minit Catch Game Surface"
      role="main"
    >
      <div
        ref={containerRef}
        data-testid="game-canvas-container"
        className="w-full h-full relative"
      />
    </main>
  );
}
