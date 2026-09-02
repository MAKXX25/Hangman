'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Captured by Next.js Error Boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#12111f]/95 border border-purple-500/30 backdrop-blur-2xl shadow-2xl text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          🎮
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white mb-1">
            Hangman Duel
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A temporary connection or page load issue occurred.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            🔄 Try Again
          </button>
          <a
            href="/"
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 font-bold text-sm transition-all text-center active:scale-95"
          >
            🏠 Home
          </a>
        </div>
      </div>
    </div>
  );
}
