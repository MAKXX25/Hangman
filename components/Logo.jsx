'use client';

import React from 'react';

/**
 * Navbar Logo Component for Hangman Duel
 * 
 * Features:
 * 1. Custom Minimalist Stickman & Gallows SVG with clean geometry.
 * 2. Glowing Purple Glassmorphic Squircle Container with hover lighting effects.
 * 3. Gradient Brand Typography ("HANGMAN" in crisp white, "DUEL" in purple-to-pink gradient).
 */
export default function Logo({ href = '#', className = '' }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-3.5 group select-none transition-transform duration-200 ${className}`}
      aria-label="Hangman Duel Home"
    >
      {/* ─── Clean Flat Icon Container ────────────────────────────── */}
      <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400 group-hover:border-purple-400/60 group-hover:bg-purple-900/30 transition-all">
        
        {/* ─── Custom Minimalist Stickman & Gallows SVG ───────────────── */}
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
          {/* Gallows Base & Vertical Post */}
          <path d="M3 21h10" />
          <path d="M6 21V3h10" />
          
          {/* Gallows Diagonal Support Strut */}
          <path d="M6 7l4-4" />
          
          {/* Hanging Rope */}
          <path d="M16 3v3" />
          
          {/* Stickman Head */}
          <circle cx="16" cy="8.5" r="2.2" />
          
          {/* Stickman Torso */}
          <path d="M16 10.7v4.3" />
          
          {/* Stickman Arms */}
          <path d="M13.5 13.2L16 11.8l2.5 1.4" />
          
          {/* Stickman Legs */}
          <path d="M14 19l2-4 2 4" />
        </svg>
      </div>

      {/* ─── Brand Typography ─────────────────────────────────────────── */}
      <div className="flex items-center tracking-wider font-extrabold text-xl sm:text-2xl uppercase font-sans">
        <span className="text-white drop-shadow-sm group-hover:text-slate-100 transition-colors">
          HANGMAN
        </span>
        <span className="ml-1.5 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-pink-400 transition-colors">
          DUEL
        </span>
      </div>
    </a>
  );
}
