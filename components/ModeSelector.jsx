'use client';

import React from 'react';
import { DIFFICULTY_CONFIG } from '../lib/difficultyConfig.js';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  ModeSelector — Dynamic PvE Difficulty Dropdown Component
 *
 *  - Fully dynamic: Renders zero hardcoded <option> tags.
 *  - Iterates Object.values(DIFFICULTY_CONFIG).
 *  - Binds value to config.id and displayed text to config.label.
 *  - onChange strictly updates the selectedDifficulty state with id.
 * ═══════════════════════════════════════════════════════════════════
 */
export default function ModeSelector({
  selectedDifficulty = 'medium',
  onChange,
  id = 'select-ai-difficulty',
  className = '',
}) {
  return (
    <div className={`mode-selector-wrapper ${className}`}>
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5"
      >
        AI Difficulty Level
      </label>
      <div className="relative">
        <select
          id={id}
          value={selectedDifficulty}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="w-full bg-[#161427]/90 text-slate-200 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/60 cursor-pointer appearance-none shadow-md hover:border-white/20"
        >
          {Object.values(DIFFICULTY_CONFIG).map((config) => (
            <option
              key={config.id}
              value={config.id}
              className="bg-[#12111f] text-slate-200 py-1"
            >
              {config.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg
            className="w-4 h-4 fill-current"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
