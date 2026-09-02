'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Complete Hangman Game Component
 * 
 * Includes:
 * 1. Declarative HTML5 Canvas stickman drawing that never disappears on React re-render.
 * 2. Full Neon Glassmorphism UI (Guesser and Chooser POVs).
 * 3. QWERTY interactive/mirrored virtual keyboard.
 * 4. Prominent "Leave Game" button with socket teardown & router redirect.
 */
export default function Game({
  secretWord = '',
  guessedLetters = [],
  wrongGuesses = [],
  lives = 6,
  maxLives = 6,
  isChooser = false,
  isRoundOver = false,
  roundResult = null,
  socket = null,
  roomCode = '',
  onGuessLetter = () => {},
  onLeaveGame = null,
}) {
  const router = useRouter();
  const canvasRef = useRef(null);

  // Normalize inputs to uppercase sets for fast O(1) membership checks
  const upperSecretWord = (secretWord || '').toUpperCase();
  const normalizedGuessed = (guessedLetters || []).map((l) => l.toUpperCase());
  const guessedSet = new Set(normalizedGuessed);

  // Split secret word into character slots
  const secretLetters = upperSecretWord.split('');
  const letterCount = secretLetters.filter((c) => c !== ' ').length;

  // QWERTY keyboard layout rows
  const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  // ─── 1. FIXED CANVAS DRAWING (LIVES DEPENDENCY & RE-RENDER RESILIENT) ───────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match display pixel ratio
    const width = 220;
    const height = 240;
    canvas.width = width;
    canvas.height = height;

    // Clear entire canvas on every state update
    ctx.clearRect(0, 0, width, height);

    // Styling
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a855f7';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate mistakes (how many parts to draw)
    const mistakes = Math.max(0, maxLives - lives);

    // Always draw base gallows structure
    ctx.beginPath();
    ctx.moveTo(20, 220);
    ctx.lineTo(100, 220); // Base
    ctx.moveTo(50, 220);
    ctx.lineTo(50, 20);   // Pole
    ctx.lineTo(150, 20);  // Beam
    ctx.moveTo(50, 50);
    ctx.lineTo(80, 20);   // Strut
    ctx.stroke();

    // Rope
    ctx.strokeStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(150, 20);
    ctx.lineTo(150, 50);
    ctx.stroke();

    // Declarative Step-by-Step Stickman Rendering based on mistakes
    // 1. Head
    if (mistakes >= 1) {
      ctx.strokeStyle = '#06b6d4';
      ctx.shadowColor = '#06b6d4';
      ctx.beginPath();
      ctx.arc(150, 65, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Eyes & Expression
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(145, 63, 1.8, 0, Math.PI * 2);
      ctx.arc(155, 63, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (mistakes >= maxLives) {
        // X eyes on defeat
        ctx.strokeStyle = '#f43f5e';
        ctx.moveTo(142, 60); ctx.lineTo(148, 66);
        ctx.moveTo(148, 60); ctx.lineTo(142, 66);
        ctx.moveTo(152, 60); ctx.lineTo(158, 66);
        ctx.moveTo(158, 60); ctx.lineTo(152, 66);
        ctx.stroke();
      } else {
        ctx.moveTo(145, 72);
        ctx.quadraticCurveTo(150, 68, 155, 72);
        ctx.stroke();
      }
    }

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#06b6d4';
    ctx.shadowColor = '#06b6d4';

    // 2. Torso / Body
    if (mistakes >= 2) {
      ctx.beginPath();
      ctx.moveTo(150, 80);
      ctx.lineTo(150, 140);
      ctx.stroke();
    }

    // 3. Left Arm
    if (mistakes >= 3) {
      ctx.beginPath();
      ctx.moveTo(150, 95);
      ctx.lineTo(125, 120);
      ctx.stroke();
    }

    // 4. Right Arm
    if (mistakes >= 4) {
      ctx.beginPath();
      ctx.moveTo(150, 95);
      ctx.lineTo(175, 120);
      ctx.stroke();
    }

    // 5. Left Leg
    if (mistakes >= 5) {
      ctx.beginPath();
      ctx.moveTo(150, 140);
      ctx.lineTo(130, 185);
      ctx.stroke();
    }

    // 6. Right Leg (Hanged)
    if (mistakes >= 6) {
      ctx.beginPath();
      ctx.moveTo(150, 140);
      ctx.lineTo(170, 185);
      ctx.stroke();
    }
  }, [lives, maxLives, isRoundOver, roundResult]);

  // ─── 2. LEAVE GAME FUNCTION ───────────────────────────────────────────────
  const handleLeaveGame = () => {
    try {
      if (socket) {
        if (roomCode) {
          socket.emit('leave_room', { roomCode });
        }
        socket.disconnect();
      }
    } catch (err) {
      console.warn('Notice while disconnecting socket:', err);
    }

    if (onLeaveGame) {
      onLeaveGame();
    } else {
      router.push('/');
    }
  };

  // Keyboard shortcut listener for Guesser
  useEffect(() => {
    if (isChooser || isRoundOver) return;

    const handleKeyDown = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key) && !guessedSet.has(key)) {
        onGuessLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChooser, isRoundOver, guessedSet, onGuessLetter]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6 text-slate-100 font-sans">
      
      {/* ─── Top Header Bar with Prominent "Leave Game" Button ──────── */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 font-mono text-xs font-semibold uppercase tracking-wider">
            {isChooser ? 'Role: Word Setter 👁️' : 'Role: Word Guesser 🎯'}
          </div>
          {roomCode && (
            <div className="hidden sm:block text-xs font-mono text-slate-400">
              Room: <span className="text-white font-bold">{roomCode}</span>
            </div>
          )}
        </div>

        {/* Prominent Red Glassmorphism Leave Game Button */}
        <button
          type="button"
          onClick={handleLeaveGame}
          className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-300 px-4 py-2 rounded-xl text-sm font-semibold transition-all backdrop-blur-md flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
          aria-label="Leave Game and return to Lobby"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Leave Game</span>
        </button>
      </div>

      {/* ─── Main Game Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Canvas & Health (4 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 p-6 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          <div className="font-mono text-xs text-slate-400 uppercase tracking-wider font-semibold">
            Gallows View
          </div>

          {/* Canvas Wrapper */}
          <div className="w-[220px] h-[240px] flex items-center justify-center bg-black/30 rounded-2xl border border-white/5 shadow-inner">
            <canvas ref={canvasRef} width={220} height={240} className="w-[220px] h-[240px]" />
          </div>

          {/* Gallows Health Hearts */}
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
                      i < lives
                        ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] scale-100'
                        : 'fill-white/10 text-white/10 scale-90'
                    }`}
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                ))}
              </div>
              <span className="font-mono text-xs font-bold text-slate-300 ml-1">
                ({lives}/{maxLives})
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Neon Secret Word & QWERTY Keyboard (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6 p-6 sm:p-8 rounded-3xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl">
          
          {/* ─── 3. FORCED NEON SECRET WORD DISPLAY ─────────────────── */}
          <section className="flex flex-col items-center justify-center text-center">
            <div className="font-mono text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
              SECRET WORD ({letterCount} {letterCount === 1 ? 'LETTER' : 'LETTERS'})
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 font-mono">
              {secretLetters.map((char, index) => {
                if (char === ' ') {
                  return <div key={index} className="w-4 sm:w-6" aria-hidden="true" />;
                }

                const isGuessed = guessedSet.has(char);

                let boxContent = '_';
                let boxStyles = '';

                if (isChooser) {
                  // Chooser POV: Always see the letter
                  boxContent = char;
                  boxStyles = isGuessed
                    ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100'
                    : 'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95';
                } else {
                  // Guesser POV: Hidden until guessed
                  boxContent = isGuessed ? char : '_';
                  boxStyles = isGuessed
                    ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-100'
                    : 'bg-white/5 border border-white/10 text-white/30';
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
          </section>

          {/* ─── 4. FORCED NEON QWERTY VIRTUAL KEYBOARD ─────────────── */}
          <section className={`flex flex-col gap-2.5 mt-2 ${isChooser ? 'pointer-events-none opacity-90' : ''}`}>
            <div className="font-mono text-xs text-slate-400 uppercase tracking-wider text-center mb-1">
              {isChooser ? "Opponent's Keyboard (Live):" : "Interactive Virtual Keyboard (Try clicking!):"}
            </div>

            <div className="flex flex-col gap-2">
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
                  {row.map((letter) => {
                    const isGuessed = guessedSet.has(letter);
                    const isCorrect = isGuessed && upperSecretWord.includes(letter);
                    const isWrong = isGuessed && !upperSecretWord.includes(letter);

                    let keyClasses = '';
                    if (isCorrect) {
                      keyClasses =
                        'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] border border-emerald-400 scale-95 cursor-default';
                    } else if (isWrong) {
                      keyClasses =
                        'bg-rose-950/60 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95';
                    } else {
                      keyClasses = isChooser
                        ? 'bg-[#2a2a35] text-white/70 border border-white/5 cursor-default'
                        : 'bg-[#2a2a35] text-white/70 hover:bg-[#3a3a45] hover:text-white border border-white/5 active:scale-95 cursor-pointer';
                    }

                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={isGuessed || isRoundOver || isChooser}
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
