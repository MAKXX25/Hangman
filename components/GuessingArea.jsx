'use client';

import React from 'react';
import { playMechanicalClick } from '../lib/audio.js';

/**
 * Redesigned Guessing Area & Arena for Hangman Duel:
 * Supports Guesser POV (!isChooser) and Chooser POV (isChooser)
 */
export default function GuessingArea({
  secretWord = '',
  guessedLetters = [],
  lives = 6,
  maxLives = 6,
  isChooser = false,
  onGuessLetter = () => {},
  disabled = false,
}) {
  const upperSecretWord = (secretWord || '').toUpperCase();
  const normalizedGuessed = (guessedLetters || []).map((l) => l.toUpperCase());
  const guessedSet = new Set(normalizedGuessed);

  const secretLetters = upperSecretWord.split('');
  const letterCount = secretLetters.filter((char) => char !== ' ').length;

  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-2 sm:gap-3 p-2.5 sm:p-3.5 md:p-4 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
      
      {/* ─── 1. SECRET WORD DISPLAY (NEON GLOWING BOXES) ──────────────── */}
      <section className="flex flex-col items-center justify-center text-center">
        <div className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 sm:mb-2">
          SECRET WORD ({letterCount} {letterCount === 1 ? 'LETTER' : 'LETTERS'})
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 md:gap-2 font-mono max-w-full my-0.5">
          {secretLetters.map((char, index) => {
            if (char === ' ') {
              return <div key={index} className="w-2 sm:w-4" aria-hidden="true" />;
            }

            const isGuessed = guessedSet.has(char);

            let boxContent = '_';
            let boxStyles = '';

            if (isChooser) {
              boxContent = char;
              boxStyles = isGuessed
                ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.5)] scale-100'
                : 'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95';
            } else {
              boxContent = isGuessed ? char : '_';
              boxStyles = isGuessed
                ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.5)] scale-100'
                : 'bg-white/5 border border-white/10 text-white/30';
            }

            return (
              <div
                key={index}
                onClick={() => playMechanicalClick()}
                className={`min-w-[28px] min-h-[36px] px-1 sm:w-9 sm:h-11 md:w-11 md:h-13 lg:w-13 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold uppercase transition-all duration-300 select-none shadow-sm cursor-pointer ${boxStyles}`}
              >
                {boxContent}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 2. GALLOWS HEALTH BAR (HEARTS SYSTEM) ────────────────────── */}
      <section className="w-full px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-2">
        <span className="font-mono text-[10px] sm:text-xs font-bold tracking-widest uppercase text-slate-300 flex-shrink-0">
          {isChooser ? "OPPONENT HEALTH:" : "HEALTH:"}
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center" aria-label={`Lives: ${lives} of ${maxLives}`}>
            {Array.from({ length: maxLives }).map((_, index) => {
              const isActive = index < lives;

              return (
                <svg
                  key={index}
                  viewBox="0 0 24 24"
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-all duration-300 ${
                    isActive
                      ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.75)] scale-100'
                      : 'fill-white/10 text-white/10 scale-90'
                  }`}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              );
            })}
          </div>

          <span className="font-mono text-xs sm:text-sm font-bold text-rose-400 ml-0.5 flex-shrink-0">
            ({lives})
          </span>
        </div>
      </section>

      {/* ─── 3. INTERACTIVE VIRTUAL KEYBOARD (QWERTY LAYOUT) ──────────── */}
      <section className={`flex flex-col gap-1 sm:gap-1.5 ${isChooser ? 'pointer-events-none opacity-90' : ''}`}>
        <div className="font-mono text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider text-center">
          {isChooser ? "Opponent's Keyboard (Live):" : "Interactive Virtual Keyboard:"}
        </div>

        <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2 w-full max-w-5xl mx-auto touch-manipulation px-1 sm:px-2">
          {KEYBOARD_ROWS.map((row, rowIndex) => {
            const rowWidthClass = rowIndex === 0 ? 'w-full' : rowIndex === 1 ? 'w-full max-w-[95%]' : 'w-full max-w-[80%]';
            return (
              <div key={rowIndex} className={`flex justify-center gap-1 sm:gap-1.5 md:gap-2 ${rowWidthClass} touch-manipulation`}>
                {row.map((letter) => {
                  const isGuessed = guessedSet.has(letter);
                  const isCorrect = isGuessed && upperSecretWord.includes(letter);
                  const isWrong = isGuessed && !upperSecretWord.includes(letter);

                  let keyClasses = '';
                  if (isCorrect) {
                    keyClasses =
                      'bg-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.6)] border-2 border-emerald-400 scale-95 cursor-default font-black';
                  } else if (isWrong) {
                    keyClasses =
                      'bg-rose-950/70 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95 opacity-60';
                  } else {
                    keyClasses = isChooser
                      ? 'bg-[#2a2a35] text-white/70 border border-white/5 cursor-default'
                      : 'bg-[#252338] text-white hover:bg-[#34314c] hover:border-purple-500/50 border border-white/15 active:scale-95 cursor-pointer shadow-lg hover:shadow-purple-500/30';
                  }

                  return (
                    <button
                      key={letter}
                      type="button"
                      aria-disabled={isGuessed || disabled || isChooser}
                      onClick={() => {
                        playMechanicalClick();
                        if (!isGuessed && !disabled && !isChooser) {
                          onGuessLetter(letter);
                        }
                      }}
                      className={`flex-1 min-w-[24px] sm:min-w-[32px] md:min-w-[40px] max-w-[82px] h-9 sm:h-10 md:h-11 lg:h-12 xl:h-13 rounded-lg sm:rounded-xl font-mono font-black text-xs sm:text-base md:text-lg flex items-center justify-center uppercase transition-all select-none touch-manipulation active:scale-95 shadow-md ${keyClasses}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
