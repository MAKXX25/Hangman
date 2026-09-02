'use client';

import React, { useEffect } from 'react';
import HangmanCanvas from './HangmanCanvas.jsx';
import { useRouter } from 'next/navigation';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

export default function GuesserPanel({
  game = null,
  onGuessLetter = () => {},
  isRoundOver = false,
  roundResult = null,
  onSpecialAnimComplete,
  onLeaveGame = null,
}) {
  const router = useRouter();

  const word = game ? (game.word || '') : '';
  const hiddenWord = game ? (game.hiddenWord || '') : '';
  const guessedLetters = game ? (game.guessedLetters || []) : [];
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const livesLeft = game ? game.livesLeft : 6;
  const maxLives = game ? game.maxLives : 6;

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isRoundOver || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key) && !guessedLetters.includes(key)) {
        onGuessLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guessedLetters, isRoundOver, onGuessLetter]);

  const guessedSet = new Set(guessedLetters.map(l => l.toUpperCase()));
  const wrongSet = new Set(wrongGuesses.map(l => l.toUpperCase()));
  const upperWord = word.toUpperCase();

  const handleLeave = () => {
    if (onLeaveGame) {
      onLeaveGame();
    } else {
      router.push('/');
    }
  };

  const hiddenSlots = hiddenWord ? hiddenWord.split(' ') : [];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6 text-slate-100 font-sans">
      
      {/* ─── Top Bar: Role Badge & Leave Game Button ──────────────────── */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold uppercase tracking-wider">
            Role: Word Guesser 🎯
          </div>
          {game?.roomCode && (
            <div className="hidden sm:block text-xs font-mono text-slate-400">
              Room: <span className="text-white font-bold">{game.roomCode}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLeave}
          className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-300 px-4 py-2 rounded-xl text-sm font-semibold transition-all backdrop-blur-md flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          aria-label="Leave Game"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Leave Game</span>
        </button>
      </div>

      {/* ─── Game Arena Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Visuals & Canvas (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 p-6 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          <div className="font-mono text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Gallows View
          </div>

          <div className="w-[220px] h-[240px] flex items-center justify-center bg-black/30 rounded-2xl border border-white/5 shadow-inner">
            <HangmanCanvas
              livesLeft={livesLeft}
              maxLives={maxLives}
              isRoundOver={isRoundOver}
              roundResult={roundResult}
              onSpecialAnimComplete={onSpecialAnimComplete}
            />
          </div>

          {/* Gallows Health */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 flex justify-between items-center backdrop-blur-md mt-2">
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-slate-400">
              Health:
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: maxLives }).map((_, i) => (
                  <svg
                    key={i}
                    viewBox="0 0 24 24"
                    className={`w-5 h-5 transition-all duration-300 ${
                      i < livesLeft
                        ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] scale-100'
                        : 'fill-white/10 text-white/10 scale-90'
                    }`}
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ))}
              </div>
              <span className="font-mono text-xs font-bold text-slate-300 ml-1">
                ({livesLeft}/{maxLives})
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Word Slots & Interactive Keyboard (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6 p-6 sm:p-8 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          
          {/* Secret Word Display */}
          <section className="flex flex-col items-center justify-center text-center">
            <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
              SECRET WORD ({hiddenSlots.length} LETTERS)
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono">
              {hiddenSlots.map((slot, index) => {
                const isRevealed = slot !== '_';

                return (
                  <div
                    key={index}
                    className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-bold uppercase transition-all duration-300 select-none ${
                      isRevealed
                        ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100'
                        : 'bg-white/5 border border-white/10 text-white/30'
                    }`}
                  >
                    {isRevealed ? slot : '_'}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Interactive Keyboard */}
          <section className="flex flex-col gap-2.5 mt-2">
            <div className="font-mono text-xs text-slate-400 uppercase tracking-wider text-center mb-1">
              Interactive Virtual Keyboard (Try clicking!):
            </div>

            <div className="flex flex-col gap-2">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
                  {row.map((letter) => {
                    const isGuessed = guessedSet.has(letter);
                    const isCorrect = isGuessed && upperWord.includes(letter);
                    const isWrong = isGuessed && !upperWord.includes(letter);

                    let keyClasses = '';
                    if (isCorrect) {
                      keyClasses =
                        'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 scale-95 cursor-default';
                    } else if (isWrong) {
                      keyClasses =
                        'bg-rose-950/60 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95';
                    } else {
                      keyClasses =
                        'bg-[#2a2a35] text-white/70 hover:bg-[#3a3a45] hover:text-white border border-white/5 active:scale-95 cursor-pointer';
                    }

                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={isGuessed || isRoundOver}
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
      </div>
    </div>
  );
}
