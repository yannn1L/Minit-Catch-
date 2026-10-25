import { useEffect, useRef, useState } from 'react';
import { startMinitCatch, type MinitCatchInstance } from './app/main.ts';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let instance: MinitCatchInstance | undefined;
    let isMounted = true;
    setInitError(null);

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
          if (isMounted) {
            setInitError(err instanceof Error ? err.message : String(err));
          }
        });
    }

    return () => {
      isMounted = false;
      instance?.destroy();
    };
  }, [attempt]);

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
      {initError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1018]/90 text-white p-6 text-center font-mono z-50">
          <p className="text-[#ff5555] font-bold text-lg mb-2">INITIALIZATION ERROR</p>
          <p className="text-sm text-gray-400 mb-6 max-w-md">{initError}</p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="px-6 py-2.5 bg-[#4070ff] hover:bg-[#3060ee] active:scale-95 text-white text-sm font-bold tracking-wider uppercase rounded cursor-pointer transition-all"
          >
            TAP TO RETRY
          </button>
        </div>
      )}
    </main>
  );
}
