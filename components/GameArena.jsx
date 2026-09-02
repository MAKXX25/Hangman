'use client';

import React from 'react';

/**
 * Dual-Mode Hangman Game Arena (Guesser View vs Chooser View)
 * 
 * Supports:
 * 1. Secret Word Display with distinct POV logic for Guesser (!isChooser) and Chooser (isChooser).
 * 2. Shared Gallows Health Bar with glowing rose hearts.
 * 3. QWERTY Keyboard with interactive clicking (Guesser) or live-mirroring (Chooser).
 */
export default function GameArena({
  secretWord = '',
  guessedLetters = [],
  lives = 6,
  maxLives = 6,
  isChooser = false,
  onGuessLetter = () => {},
  disabled = false,
}) {
  // Normalize inputs to uppercase sets for instant O(1) membership testing
  const upperSecretWord = (secretWord || '').toUpperCase();
  const normalizedGuessed = (guessedLetters || []).map((l) => l.toUpperCase());
  const guessedSet = new Set(normalizedGuessed);

  // Split word into characters and count actual letters
  const secretLetters = upperSecretWord.split('');
  const letterCount = secretLetters.filter((char) => char !== ' ').length;

  // QWERTY keyboard layout rows
  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 p-6 sm:p-8 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all">
      
      {/* ─── 1. SECRET WORD DISPLAY (MULTIPLAYER LOGIC) ──────────────── */}
      <section className="flex flex-col items-center justify-center text-center">
        {/* Dynamic Header */}
        <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          SECRET WORD ({letterCount} {letterCount === 1 ? 'LETTER' : 'LETTERS'})
        </div>

        {/* Letter Boxes */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono">
          {secretLetters.map((char, index) => {
            // Space separator for multi-word phrases
            if (char === ' ') {
              return <div key={index} className="w-4 sm:w-6" aria-hidden="true" />;
            }

            const isGuessed = guessedSet.has(char);

            // ─── POV Conditional Styling Calculation ───
            let boxContent = '_';
            let boxStyles = '';

            if (isChooser) {
              // CHOOSER POV: Always reveal the letter
              boxContent = char;
              if (isGuessed) {
                // Opponent guessed this letter
                boxStyles =
                  'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100';
              } else {
                // Opponent has NOT guessed this letter yet
                boxStyles =
                  'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95';
              }
            } else {
              // GUESSER POV: Only reveal if guessed
              if (isGuessed) {
                boxContent = char;
                boxStyles =
                  'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100';
              } else {
                boxContent = '_';
                boxStyles =
                  'bg-white/5 border border-white/10 text-white/30';
              }
            }

            return (
              <div
                key={index}
                className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-bold uppercase transition-all duration-300 select-none ${boxStyles}`}
              >
                {boxContent}
              </div>
            );
          })}
        </div>

        {/* Chooser Info Pill */}
        {isChooser && (
          <div className="mt-3 text-[11px] font-mono text-purple-300/80 bg-purple-950/40 border border-purple-500/20 px-3 py-1 rounded-full">
            👁️ You are viewing as Chooser. Dashed boxes indicate letters hidden from your opponent.
          </div>
        )}
      </section>

      {/* ─── 2. SHARED GALLOWS HEALTH BAR ────────────────────────────── */}
      <section className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 backdrop-blur-md">
        {/* Left Label */}
        <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider uppercase text-slate-400">
          Gallows Health:
        </span>

        {/* Right Hearts & Lives Counter */}
        <div className="flex items-center gap-3">
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

          <span className="font-mono text-xs sm:text-sm font-bold text-slate-300 ml-1">
            ({lives})
          </span>
        </div>
      </section>

      {/* ─── 3. QWERTY VIRTUAL KEYBOARD (INTERACTIVE vs LIVE-MIRROR) ─── */}
      <section className={`flex flex-col gap-2.5 mt-2 ${isChooser ? 'pointer-events-none opacity-90' : ''}`}>
        {/* Dynamic Context Header */}
        <div className="font-mono text-xs text-slate-400 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-2">
          {isChooser ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Opponent&apos;s Keyboard (Live):</span>
            </>
          ) : (
            <span>Interactive Virtual Keyboard (Try clicking!):</span>
          )}
        </div>

        {/* Keyboard Key Rows */}
        <div className="flex flex-col gap-2">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
              {row.map((letter) => {
                const isGuessed = guessedSet.has(letter);
                const isCorrect = isGuessed && upperSecretWord.includes(letter);
                const isWrong = isGuessed && !upperSecretWord.includes(letter);

                let keyClasses = '';
                if (isCorrect) {
                  // Correct Guess
                  keyClasses =
                    'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 scale-95 cursor-default';
                } else if (isWrong) {
                  // Wrong Guess
                  keyClasses =
                    'bg-rose-950/60 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95';
                } else {
                  // Default / Unguessed
                  keyClasses = isChooser
                    ? 'bg-[#2a2a35] text-white/70 border border-white/5 cursor-default'
                    : 'bg-[#2a2a35] text-white/70 hover:bg-[#3a3a45] hover:text-white border border-white/5 active:scale-95 cursor-pointer';
                }

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={isGuessed || disabled || isChooser}
                    onClick={() => onGuessLetter(letter)}
                    className={`w-8 h-10 sm:w-10 sm:h-12 rounded-lg font-mono font-bold text-sm sm:text-base flex items-center justify-center uppercase transition-all select-none ${keyClasses}`}
                    aria-label={`Letter ${letter}`}
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
