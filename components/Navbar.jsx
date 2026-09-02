'use client';

import React from 'react';

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
    <header className="relative w-full flex items-center justify-between px-6 py-4 bg-[#09090b] border-b border-white/5 z-50">
      
      {/* ─── 1. Left: Brand Logo ────────────────────────────────────── */}
      <a
        href="#"
        className="inline-flex items-center gap-3 group select-none z-10"
        aria-label="Hangman Duel Home"
      >
        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400 group-hover:border-purple-400/60 group-hover:bg-purple-900/30 transition-all">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 transition-transform duration-200 group-hover:scale-105"
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

        <div className="flex items-center text-lg font-bold uppercase tracking-wider">
          <span className="text-white">Hangman</span>
          <span className="ml-1.5 text-purple-400">Duel</span>
        </div>
      </a>

      {/* ─── 2. Center: Absolute Centered Navigation Links ─────────── */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8 z-10">
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

      {/* ─── 3. Right: Play Now CTA Button ──────────────────────────── */}
      <div className="flex items-center gap-4 z-10">
        <button
          onClick={handlePlayClick}
          className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 active:scale-[0.98] transition-all cursor-pointer shadow-sm"
        >
          Play Now
        </button>
      </div>

    </header>
  );
}
