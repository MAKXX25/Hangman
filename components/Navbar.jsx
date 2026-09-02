'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

/**
 * Navbar Component
 * 
 * - Only visible on the home route ('/').
 * - Inner contents constrained to max-w-7xl mx-auto w-full.
 * - Dead-center absolute navigation links.
 */
export default function Navbar({ onPlayNow }) {
  const pathname = usePathname();

  // Route Restriction: Only display on the home landing page
  if (pathname && pathname !== '/') {
    return null;
  }

  const handleScrollTo = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePlayClick = () => {
    if (onPlayNow) {
      onPlayNow();
    } else {
      const input = document.getElementById('input-name') || document.getElementById('hero');
      if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (typeof input.focus === 'function') input.focus();
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#09090b]/95 backdrop-blur-sm border-b border-white/5 transition-colors">
      {/* ─── Constrained Container for Ultra-Wide Screens ───────────── */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2.5 sm:py-4 relative flex items-center justify-between">
        
        {/* ─── 1. Left: Brand Logo ──────────────────────────────────── */}
        <a
          href="#"
          className="inline-flex items-center gap-2 sm:gap-3 group select-none z-10 flex-shrink-0"
          aria-label="Hangman Duel Home"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400 group-hover:border-purple-400/60 group-hover:bg-purple-900/30 transition-all">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:scale-105"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M3 21h10" />
              <path d="M6 21V3h10" />
              <path d="M6 7l4-4" />
              <path d="M16 3v3" />
              <circle cx="16" cy="8.5" r="2.2" />
              <path d="M16 10.7v4.3" />
              <path d="M13.5 13.2L16 11.8l2.5 1.4" />
              <path d="M14 19l2-4 2 4" />
            </svg>
          </div>

          <div className="flex items-center text-sm sm:text-lg font-bold uppercase tracking-wider">
            <span className="text-white">Hangman</span>
            <span className="ml-1 sm:ml-1.5 text-purple-400">Duel</span>
          </div>
        </a>

        {/* ─── 2. Center: Dead-Center Navigation Links (Hidden on Mobile) ─── */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 z-10">
          <a
            href="#features"
            onClick={handleScrollTo('features')}
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Features
          </a>
          <a
            href="#how-to-play"
            onClick={handleScrollTo('how-to-play')}
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            How to Play
          </a>
        </div>

        {/* ─── 3. Right: Play Now CTA Button ────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-4 z-10 flex-shrink-0">
          <button
            type="button"
            onClick={handlePlayClick}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            Play Now
          </button>
        </div>

      </div>
    </header>
  );
}
