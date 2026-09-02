'use client';

import React from 'react';

/**
 * Navbar Component
 * 
 * - Shows brand logo on the left.
 * - Shows "How to Play" and "Features" navigation links in the top bar.
 * - Shows "Play Now" action button on the right.
 * - Fully responsive with smooth scrolling.
 */
export default function Navbar({ onPlayNow }) {
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
    <header className="sticky top-0 z-50 w-full bg-[#09090b]/95 backdrop-blur-md border-b border-white/10 transition-all shadow-lg shadow-black/20">
      {/* ─── Constrained Container for All Screens ───────────── */}
      <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 py-2.5 sm:py-3.5 relative flex items-center justify-between gap-2">
        
        {/* ─── 1. Left: Brand Logo ──────────────────────────────────── */}
        <a
          href="#"
          className="inline-flex items-center gap-2 sm:gap-3 group select-none flex-shrink-0"
          aria-label="Hangman Duel Home"
          onClick={handleScrollTo('hero')}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-400 group-hover:border-purple-400 group-hover:bg-purple-900/40 transition-all shadow-sm">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:scale-110 text-purple-300"
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

        {/* ─── 2. Center: Navigation Links ("How to Play" & "Features") ─── */}
        <nav className="flex items-center gap-1 sm:gap-3 md:gap-8" aria-label="Main Navigation">
          <a
            href="#how-to-play"
            onClick={handleScrollTo('how-to-play')}
            className="px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span className="text-amber-400 text-xs sm:text-sm">🎮</span>
            <span>How to Play</span>
          </a>
          <a
            href="#features"
            onClick={handleScrollTo('features')}
            className="px-2 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <span className="text-purple-400 text-xs sm:text-sm">✨</span>
            <span>Features</span>
          </a>
        </nav>

        {/* ─── 3. Right: Play Now CTA Button ────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <button
            type="button"
            onClick={handlePlayClick}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs sm:text-sm px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg transition-all cursor-pointer shadow-md shadow-purple-600/25 active:scale-95 flex items-center gap-1.5"
          >
            <span>Play Now</span>
            <span className="text-xs">⚡</span>
          </button>
        </div>

      </div>
    </header>
  );
}
