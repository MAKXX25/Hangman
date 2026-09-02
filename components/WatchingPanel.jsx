'use client';

import React, { useState, useEffect } from 'react';
import HangmanCanvas from './HangmanCanvas.jsx';
import { getRandomFact } from '../lib/facts.js';
import { useRouter } from 'next/navigation';

export default function WatchingPanel({
  game = null,
  isRoundOver = false,
  roundResult = null,
  onSpecialAnimComplete,
  onLeaveGame = null,
}) {
  const router = useRouter();
  const [currentFact, setCurrentFact] = useState('');

  useEffect(() => {
    setCurrentFact(getRandomFact());
    const interval = setInterval(() => {
      setCurrentFact(getRandomFact());
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const word = game ? (game.word || '') : '';
  const hiddenWord = game ? (game.hiddenWord || '') : '';
  const guessedLetters = game ? (game.guessedLetters || []) : [];
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const livesLeft = game ? game.livesLeft : 6;
  const maxLives = game ? game.maxLives : 6;

  const handleLeave = () => {
    if (onLeaveGame) {
      onLeaveGame();
    } else {
      router.push('/');
    }
  };

  const wordChars = word ? word.toUpperCase().split('') : [];
  const guessedSet = new Set(guessedLetters.map(l => l.toUpperCase()));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6 text-slate-100 font-sans">
      
      {/* ─── Top Bar: Role Badge & Leave Game Button ──────────────────── */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold uppercase tracking-wider">
            Role: Word Setter (Watching) 👁️
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

      {/* ─── Main Content Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Canvas & Opponent Lives (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 p-6 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          <div className="font-mono text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Opponent&apos;s Gallows
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

          {/* Health Bar */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 flex justify-between items-center backdrop-blur-md mt-2">
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-slate-400">
              Opponent Lives:
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

        {/* Right Column: Word Overview & Live Progress (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6 p-6 sm:p-8 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          
          {/* Secret Word Display for Chooser */}
          <section className="flex flex-col items-center justify-center text-center">
            <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
              SECRET WORD ({wordChars.length} LETTERS)
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono">
              {wordChars.map((char, index) => {
                const isGuessed = guessedSet.has(char);

                return (
                  <div
                    key={index}
                    className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl text-xl sm:text-2xl font-bold uppercase transition-all duration-300 select-none ${
                      isGuessed
                        ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100'
                        : 'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95'
                    }`}
                  >
                    {char}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[11px] font-mono text-purple-300/80 bg-purple-950/40 border border-purple-500/20 px-3 py-1 rounded-full">
              Dashed boxes indicate letters your opponent has not guessed yet.
            </div>
          </section>

          {/* Trivia / Facts Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-2">
            <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-purple-300">
              <span>💡</span>
              <span>Hangman Trivia</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed italic">
              &ldquo;{currentFact}&rdquo;
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
