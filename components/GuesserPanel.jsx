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
  const activeHint = game ? (game.hint || game.meaning || '') : '';

  const [showHint, setShowHint] = React.useState(true);

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

  const handleLeave = () => {
    if (onLeaveGame) {
      onLeaveGame();
    } else {
      router.push('/');
    }
  };

  const guessedSet = new Set(guessedLetters.map((l) => l.toUpperCase()));
  const upperWord = word.toUpperCase();

  // Normalize hiddenWord to array of characters
  let hiddenSlots = [];
  if (Array.isArray(hiddenWord)) {
    hiddenSlots = hiddenWord;
  } else if (typeof hiddenWord === 'string' && hiddenWord.includes(' ')) {
    hiddenSlots = hiddenWord.trim().split(/\s+/);
  } else if (typeof hiddenWord === 'string' && hiddenWord.length > 0) {
    hiddenSlots = hiddenWord.split('');
  } else if (upperWord) {
    hiddenSlots = upperWord.split('').map((ch) => (guessedSet.has(ch) ? ch : '_'));
  }

  return (
    <div
      id="panel-guesser"
      className="w-full max-w-7xl mx-auto flex-1 flex flex-col justify-between gap-2 sm:gap-4 md:gap-5 py-1 sm:py-2"
    >
      {/* ─── TOP STATUS BAR: Header & Leave Game ──────────────────────────── */}
      <div className="w-full flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold">
            <span>🎮</span>
            <span>Guesser Mode</span>
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

      {/* ─── 1. TOP ROW: Gallows View & Secret Word Display ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 md:gap-5 lg:gap-6 items-stretch flex-1 min-h-0">
        
        {/* Left Column: Visuals & Canvas (5 cols) */}
        <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 p-2 sm:p-3 md:p-5 lg:p-6 rounded-2xl md:rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl min-h-0">
          <div className="font-mono text-[9px] sm:text-[11px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Gallows View
          </div>

          <div className="w-full max-w-[120px] sm:max-w-[170px] md:max-w-[220px] aspect-[11/12] flex items-center justify-center bg-black/30 rounded-lg sm:rounded-xl md:rounded-2xl border border-white/5 shadow-inner p-1 sm:p-2">
            <HangmanCanvas
              livesLeft={livesLeft}
              maxLives={maxLives}
              isRoundOver={isRoundOver}
              roundResult={roundResult}
              onSpecialAnimComplete={onSpecialAnimComplete}
            />
          </div>
        </div>

        {/* Right Column: Secret Word Display + Clue (7 cols) */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col items-center justify-center gap-2 sm:gap-3 p-3 sm:p-5 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl text-center min-h-[120px] sm:min-h-0">
          <div className="flex items-center justify-between w-full px-1">
            <div className="font-mono text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-widest text-slate-400">
              SECRET WORD ({hiddenSlots.length} LETTERS)
            </div>
            {activeHint && (
              <button
                type="button"
                onClick={() => setShowHint((prev) => !prev)}
                className="px-2.5 py-1 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                title={showHint ? 'Hide Clue' : 'Show Clue'}
              >
                <span>💡</span>
                <span>{showHint ? 'Hide Clue' : 'Show Clue'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 md:gap-2.5 lg:gap-3.5 font-mono max-w-full my-0.5">
            {hiddenSlots.map((slot, index) => {
              const isRevealed = slot !== '_';

              return (
                <div
                  key={index}
                  className={`min-w-[32px] min-h-[42px] px-1 sm:w-10 sm:h-12 md:w-13 md:h-15 lg:w-16 lg:h-18 flex items-center justify-center rounded-lg sm:rounded-xl md:rounded-2xl text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold uppercase transition-all duration-300 select-none shadow-sm ${
                    isRevealed
                      ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.5)] scale-100'
                      : 'bg-white/5 border border-white/10 text-white/30'
                  }`}
                >
                  {isRevealed ? slot : '_'}
                </div>
              );
            })}
          </div>

          {/* Word Hint / Clue Banner */}
          {activeHint && showHint && (
            <div className="w-full mt-1 px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/30 backdrop-blur-md flex items-start sm:items-center justify-center gap-2 text-center animate-fadeIn shadow-sm">
              <span className="text-sm flex-shrink-0">💡</span>
              <p className="text-xs sm:text-sm text-purple-200 font-medium leading-snug">
                <strong className="text-purple-300 font-semibold uppercase tracking-wider text-[10px] sm:text-xs mr-1">Clue:</strong>
                {activeHint}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ─── 2. MIDDLE ROW: Separated Health Bar & Wrong Letters ─────── */}
      <div className="w-full px-2.5 py-1.5 sm:px-5 sm:py-2.5 md:py-3.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-4">
        {/* Health & Big Hearts */}
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 flex-wrap justify-center sm:justify-start">
          <span className="font-mono text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase text-slate-300 flex-shrink-0">
            HEALTH:
          </span>
          <div className="flex items-center gap-0.5 sm:gap-1.5 flex-wrap justify-center">
            {Array.from({ length: maxLives }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 24 24"
                className={`w-3.5 h-3.5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 transition-all duration-300 ${
                  i < livesLeft
                    ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.75)] scale-100'
                    : 'fill-white/10 text-white/10 scale-90'
                }`}
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ))}
          </div>
          <span className="font-mono text-xs sm:text-sm md:text-base lg:text-lg font-bold text-rose-400 ml-0.5 flex-shrink-0">
            ({livesLeft})
          </span>
        </div>

        {/* Wrong Letters */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-center sm:justify-end">
          <span className="font-mono text-[10px] sm:text-xs md:text-sm font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">
            WRONG LETTERS:
          </span>
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-h-[20px] sm:min-h-[26px]">
            {wrongGuesses.length === 0 ? (
              <span className="text-[10px] sm:text-xs md:text-sm text-slate-500 italic">None yet</span>
            ) : (
              wrongGuesses.map((l, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded sm:rounded-md bg-rose-950/70 border border-rose-500/40 text-rose-300 font-mono font-bold text-[10px] sm:text-xs md:text-sm shadow-sm"
                >
                  {l}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. BOTTOM ROW: Interactive QWERTY Keyboard (Optimized for Mobile) ─────────────────────── */}
      <div className="w-full p-2.5 sm:p-3.5 md:p-4 rounded-2xl md:rounded-3xl bg-[#12111f]/95 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col items-center gap-1 sm:gap-2">
        <div className="font-mono text-[9px] sm:text-[11px] md:text-xs text-slate-400 uppercase tracking-wider text-center">
          Interactive Virtual Keyboard
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2 w-full max-w-2xl mx-auto touch-manipulation items-center">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1 sm:gap-1.5 md:gap-2 w-full max-w-full touch-manipulation">
              {row.map((letter) => {
                const isGuessed = guessedSet.has(letter);
                const isCorrect = isGuessed && upperWord.includes(letter);
                const isWrong = isGuessed && !upperWord.includes(letter);

                let keyClasses = '';
                if (isCorrect) {
                  keyClasses =
                    'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 scale-95 cursor-default font-black';
                } else if (isWrong) {
                  keyClasses =
                    'bg-rose-950/70 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95 opacity-60';
                } else {
                  keyClasses =
                    'bg-[#252338] text-white hover:bg-[#34314c] hover:border-purple-500/40 border border-white/10 active:scale-95 cursor-pointer shadow-md hover:shadow-purple-500/20';
                }

                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={isGuessed || isRoundOver}
                    onClick={() => onGuessLetter(letter)}
                    className={`flex-1 max-w-[34px] sm:max-w-none sm:flex-initial sm:w-10 md:w-11 lg:w-12 h-10 sm:h-11 md:h-12 lg:h-13 rounded-lg sm:rounded-xl font-mono font-bold text-xs sm:text-base md:text-lg flex items-center justify-center uppercase transition-all select-none touch-manipulation active:scale-95 ${keyClasses}`}
                    aria-label={`Letter ${letter}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
