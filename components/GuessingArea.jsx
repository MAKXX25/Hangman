'use client';

import React from 'react';

/**
 * GuessingArea Component
 * 
 * Redesigned with a neon-glassmorphism aesthetic:
 * 1. Secret Word Display with glowing neon cyan letter boxes.
 * 2. Gallows Health Bar with glowing rose heart indicators.
 * 3. Interactive Virtual QWERTY Keyboard with dynamic state styling (Default, Correct, Wrong).
 * 
 * @param {string} secretWord - The target word (e.g. "PIXEL" or "REACT")
 * @param {Array<string>} guessedLetters - Array of uppercase guessed letters (e.g. ['P', 'E', 'X'])
 * @param {number} lives - Current remaining lives (default: 6)
 * @param {number} maxLives - Total max lives (default: 6)
 * @param {function} onGuessLetter - Callback when a key is clicked: (letter: string) => void
 * @param {boolean} disabled - Optional boolean to disable the keyboard (e.g. round over)
 */
export default function GuessingArea({
  secretWord = '',
  guessedLetters = [],
  lives = 6,
  maxLives = 6,
  onGuessLetter = () => {},
  disabled = false,
}) {
  // Normalize inputs to uppercase
  const upperSecretWord = (secretWord || '').toUpperCase();
  const normalizedGuessed = (guessedLetters || []).map((l) => l.toUpperCase());
  const guessedSet = new Set(normalizedGuessed);

  // Split secret word into individual characters
  const secretLetters = upperSecretWord.split('');
  
  // Calculate dynamic non-space letter count
  const letterCount = secretLetters.filter((char) => char !== ' ').length;

  // QWERTY keyboard layout rows
  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-8 p-6 sm:p-8 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
      
      {/* ─── 1. SECRET WORD DISPLAY (NEON GLOWING BOXES) ──────────────── */}
      <section className="flex flex-col items-center justify-center text-center">
        {/* Dynamic Header */}
        <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          SECRET WORD ({letterCount} {letterCount === 1 ? 'LETTER' : 'LETTERS'})
        </div>

        {/* Letter Boxes Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono">
          {secretLetters.map((char, index) => {
            // Handle space character between multi-word puzzles
            if (char === ' ') {
              return <div key={index} className="w-4 sm:w-6" aria-hidden="true" />;
            }

            const isGuessed = guessedSet.has(char);

            return (
              <div
                key={index}
                className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-bold transition-all duration-300 ${
                  isGuessed
                    ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100'
                    : 'bg-white/5 border border-white/10 text-white/30'
                }`}
              >
                {isGuessed ? char : '_'}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 2. GALLOWS HEALTH BAR (HEARTS SYSTEM) ────────────────────── */}
      <section className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 backdrop-blur-md">
        {/* Left Side Label */}
        <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider uppercase text-slate-400">
          Gallows Health:
        </span>

        {/* Right Side Hearts & Count */}
        <div className="flex items-center gap-3">
          {/* Row of Heart Icons */}
          <div className="flex items-center gap-1.5" aria-label={`Lives: ${lives} of ${maxLives}`}>
            {Array.from({ length: maxLives }).map((_, index) => {
              const isActive = index < lives;

              return (
                <svg
                  key={index}
                  viewBox="0 0 24 24"
                  className={`w-5 h-5 sm:w-6 sm:h-6 transition-all duration-300 ${
                    isActive
                      ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] scale-100'
                      : 'fill-white/10 text-white/10 scale-90'
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              );
            })}
          </div>

          {/* Lives Counter Text */}
          <span className="font-mono text-xs sm:text-sm font-bold text-slate-300 ml-1">
            ({lives}/{maxLives} Lives)
          </span>
        </div>
      </section>

      {/* ─── 3. INTERACTIVE VIRTUAL KEYBOARD (QWERTY LAYOUT) ──────────── */}
      <section className="flex flex-col gap-2.5">
        {/* Header */}
        <div className="font-mono text-xs text-slate-400 uppercase tracking-wider text-center mb-1">
          Interactive Virtual Keyboard (Try clicking!):
        </div>

        {/* Keyboard QWERTY Rows */}
        <div className="flex flex-col gap-2">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
              {row.map((letter) => {
                const isGuessed = guessedSet.has(letter);
                const isCorrect = isGuessed && upperSecretWord.includes(letter);
                const isWrong = isGuessed && !upperSecretWord.includes(letter);

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={isGuessed || disabled}
                    onClick={() => onGuessLetter(letter)}
                    className={`w-8 h-10 sm:w-10 sm:h-12 rounded-lg font-mono font-bold text-sm sm:text-base flex items-center justify-center transition-all select-none ${
                      isCorrect
                        ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 scale-95 cursor-default'
                        : isWrong
                        ? 'bg-rose-950/50 text-rose-500 line-through opacity-80 border border-rose-500/30 cursor-not-allowed scale-95'
                        : 'bg-white/10 text-white hover:bg-white/20 active:scale-95 border border-white/10 hover:border-white/25 cursor-pointer'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
