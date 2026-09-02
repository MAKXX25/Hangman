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
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2 sm:py-4 flex-1 flex flex-col justify-between gap-3 sm:gap-4 md:gap-5 text-slate-100 font-sans">
      
      {/* ─── Top Bar: Role Badge & Leave Game Button ──────────────────── */}
      <div className="w-full flex items-center justify-between pb-2.5 sm:pb-3 border-b border-white/10 flex-wrap sm:flex-nowrap gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold uppercase tracking-wider">
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
          className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-300 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all backdrop-blur-md flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-sm active:scale-95"
          aria-label="Leave Game"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Leave Game</span>
        </button>
      </div>

      {/* ─── 1. TOP ROW: Opponent's Gallows & Secret Word Display ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:gap-5 lg:gap-6 items-stretch flex-1 min-h-0">
        
        {/* Left Column: Visuals & Canvas (5 cols) */}
        <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 lg:p-6 rounded-2xl sm:rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl min-h-0">
          <div className="font-mono text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Opponent&apos;s Gallows
          </div>

          <div className="w-full max-w-[260px] aspect-[11/12] flex items-center justify-center bg-black/30 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner p-1 sm:p-2">
            <HangmanCanvas
              livesLeft={livesLeft}
              maxLives={maxLives}
              isRoundOver={isRoundOver}
              roundResult={roundResult}
              onSpecialAnimComplete={onSpecialAnimComplete}
            />
          </div>
        </div>

        {/* Right Column: Secret Word Display for Chooser (7 cols) */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl text-center min-h-0">
          <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400">
            SECRET WORD ({wordChars.length} LETTERS)
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3 lg:gap-3.5 font-mono max-w-full">
            {wordChars.map((char, index) => {
              const isGuessed = guessedSet.has(char);

              return (
                <div
                  key={index}
                  className={`w-9 h-11 sm:w-12 sm:h-14 md:w-14 md:h-16 lg:w-16 lg:h-18 flex items-center justify-center rounded-xl sm:rounded-2xl text-xl sm:text-3xl md:text-4xl font-extrabold uppercase transition-all duration-300 select-none shadow-sm ${
                    isGuessed
                      ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.5)] scale-100'
                      : 'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95'
                  }`}
                >
                  {char}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-purple-300/80 bg-purple-950/40 border border-purple-500/20 px-3 py-1 rounded-full">
            Dashed boxes indicate letters your opponent has not guessed yet.
          </div>
        </div>
      </div>

      {/* ─── 2. MIDDLE ROW: Opponent Health Bar & Wrong Letters ─────────────── */}
      <div className="w-full px-3.5 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        {/* Health & Big Hearts */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap justify-center sm:justify-start">
          <span className="font-mono text-xs sm:text-sm font-bold tracking-widest uppercase text-slate-400 flex-shrink-0">
            OPPONENT HEALTH:
          </span>
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
            {Array.from({ length: maxLives }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 transition-all duration-300 ${
                  i < livesLeft
                    ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.75)] scale-100'
                    : 'fill-white/10 text-white/10 scale-90'
                }`}
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ))}
          </div>
          <span className="font-mono text-sm sm:text-base md:text-lg font-bold text-rose-400 ml-1 flex-shrink-0">
            ({livesLeft})
          </span>
        </div>

        {/* Opponent's Wrong Letters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center sm:justify-end">
          <span className="font-mono text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">
            WRONG LETTERS:
          </span>
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-h-[24px] sm:min-h-[28px]">
            {wrongGuesses.length === 0 ? (
              <span className="text-xs sm:text-sm text-slate-500 italic">None yet</span>
            ) : (
              wrongGuesses.map((l, i) => (
                <span key={i} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 font-mono font-bold text-xs sm:text-sm shadow-sm">
                  {l}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. BOTTOM ROW: Trivia / Facts Card ─────────────────────────────── */}
      <div className="w-full p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-1.5">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase text-purple-300">
          <span>💡</span>
          <span>Hangman Trivia</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
          &ldquo;{currentFact}&rdquo;
        </p>
      </div>
    </div>
  );
}
