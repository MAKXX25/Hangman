'use client';

import React, { useState } from 'react';

export default function LandingPage({ onPlayNow, onPlayPvE }) {
  // Interactive mock state for the Split Showcase PvE card
  const [guessedLetters, setGuessedLetters] = useState({
    P: 'correct',
    X: 'correct',
    L: 'correct',
    E: 'wrong',
    O: 'wrong',
    T: 'wrong',
  });
  const [pveWord, setPveWord] = useState(['P', 'I', 'X', 'E', 'L']);
  const [revealedChars, setRevealedChars] = useState(['P', '_', 'X', '_', 'L']);

  // Handle clicking mock keyboard buttons in the showcase
  const handleMockKeyClick = (letter) => {
    if (guessedLetters[letter]) return;
    const targetWord = ['P', 'I', 'X', 'E', 'L'];
    if (targetWord.includes(letter)) {
      setGuessedLetters((prev) => ({ ...prev, [letter]: 'correct' }));
      setRevealedChars((prev) =>
        prev.map((c, idx) => (targetWord[idx] === letter ? letter : c))
      );
    } else {
      setGuessedLetters((prev) => ({ ...prev, [letter]: 'wrong' }));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a10] text-slate-100 font-sans selection:bg-purple-500 selection:text-white relative overflow-x-hidden">
      {/* ─── Google Font Injection for Blocky Display Typography ──────── */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;700;800;900&family=JetBrains+Mono:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');
        
        .font-display {
          font-family: 'Chakra Petch', 'Orbitron', 'JetBrains Mono', -apple-system, sans-serif;
          letter-spacing: -0.02em;
        }
        .font-mono-code {
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>

      {/* ─── Subtle Ambient Background Glows & Grid Pattern ─────────── */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Top Center Purple Radial Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[550px] bg-gradient-to-b from-violet-600/25 via-purple-600/10 to-transparent blur-[120px] rounded-full" />
        
        {/* Subtle Cyan Ambient Side Glow */}
        <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 blur-[140px] rounded-full" />
        
        {/* Subtle Bottom Green Glow */}
        <div className="absolute bottom-[10%] left-[-5%] w-[450px] h-[450px] bg-emerald-500/10 blur-[130px] rounded-full" />
        
        {/* Geometric Grid Texture */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* ─── 1. NAVBAR ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0a10]/80 border-b border-white/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Left: Brand Logo with Gamepad Icon */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-800 p-0.5 shadow-lg shadow-purple-600/20 group-hover:shadow-purple-500/40 transition-all duration-300">
              <div className="w-full h-full bg-[#0d0c18] rounded-[10px] flex items-center justify-center">
                {/* Gamepad Icon */}
                <svg className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 6H9a7 7 0 00-7 7v1a4 4 0 004 4h12a4 4 0 004-4v-1a7 7 0 00-7-7z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4m-2-2v4m9-3a1 1 0 11-2 0 1 1 0 012 0zm3 2a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
            </div>
            <span className="font-display text-xl font-bold tracking-wider text-white uppercase group-hover:text-purple-300 transition-colors">
              Hangman <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Duel</span>
            </span>
          </a>

          {/* Center: Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors duration-200">
              Features
            </a>
            <a href="#how-to-play" className="hover:text-white transition-colors duration-200">
              How to Play
            </a>
            <a href="#modes" className="hover:text-white transition-colors duration-200">
              Modes
            </a>
          </nav>

          {/* Right: Vibrant 'Play Now' CTA */}
          <div className="flex items-center gap-4">
            <button
              onClick={onPlayNow || (() => { window.location.href = '#hero'; })}
              className="relative group px-6 py-2.5 rounded-xl font-semibold text-sm text-white overflow-hidden shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 transition-all duration-300 group-hover:opacity-90" />
              <div className="relative flex items-center gap-2">
                <span>Play Now</span>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ─── 2. HERO SECTION ────────────────────────────────────────── */}
      <section id="hero" className="relative z-10 pt-16 pb-24 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/25 backdrop-blur-sm text-yellow-400 text-xs font-mono-code font-bold tracking-widest uppercase mb-8 shadow-sm shadow-yellow-500/10 animate-pulse-slow">
            <span>⚡ MULTIPLAYER WORD DUEL</span>
          </div>

          {/* Headline in Blocky Display Font */}
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold uppercase tracking-tight text-white leading-[1.08] mb-6 drop-shadow-sm">
            Guess the word.{' '}
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-400">
              Save the stickman.
            </span>
            <span className="block mt-1">Win the duel.</span>
          </h1>

          {/* Subheadline */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 font-normal leading-relaxed mb-10">
            Real-time, head-to-head Hangman engineered for fast rounds, intense mind games, and instant room invites. Challenge friends online or train against the AI wordmaster.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={onPlayNow || (() => {})}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-display font-bold text-base uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-xl shadow-purple-600/35 hover:shadow-purple-500/55 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create a Room</span>
            </button>

            <button
              onClick={onPlayPvE || onPlayNow || (() => {})}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-display font-bold text-base uppercase tracking-wider text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-md"
            >
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Play vs Computer</span>
            </button>
          </div>

          {/* ─── Hero Graphic: Floating Game State Mock Card ─────────── */}
          <div className="relative max-w-2xl mx-auto">
            {/* Card Outer Glow Border */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600/40 via-cyan-500/30 to-purple-600/40 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-1000" />
            
            <div className="relative bg-[#11101d]/90 border border-white/15 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl text-left">
              
              {/* Card Header Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  <span className="ml-2 font-mono-code text-xs text-slate-400 tracking-wider">ROOM #DUEL-894</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono-code font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE MATCH</span>
                </div>
              </div>

              {/* Game Visual: Stickman Canvas Mock */}
              <div className="flex flex-col items-center justify-center my-4">
                <div className="w-32 h-28 relative flex items-center justify-center">
                  <svg className="w-full h-full drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]" viewBox="0 0 100 90" fill="none" stroke="#c084fc" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {/* Gallows Structure */}
                    <path d="M15 85 L85 85" stroke="#7c3aed" strokeWidth="4" />
                    <path d="M30 85 L30 10 L65 10 L65 22" stroke="#7c3aed" strokeWidth="3.5" />
                    <path d="M30 25 L45 10" stroke="#7c3aed" strokeWidth="2.5" />
                    {/* Stickman (Head, Body, Arms, Leg) */}
                    <circle cx="65" cy="30" r="8" stroke="#38bdf8" strokeWidth="3" />
                    <line x1="65" y1="38" x2="65" y2="58" stroke="#38bdf8" strokeWidth="3" />
                    <line x1="65" y1="44" x2="52" y2="52" stroke="#38bdf8" strokeWidth="3" />
                    <line x1="65" y1="44" x2="78" y2="52" stroke="#38bdf8" strokeWidth="3" />
                    <line x1="65" y1="58" x2="54" y2="74" stroke="#38bdf8" strokeWidth="3" />
                  </svg>
                </div>

                {/* Secret Word Display Slots */}
                <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 my-6 font-mono-code">
                  {['_', 'A', '_', 'B', '_', 'A', '_'].map((char, index) => (
                    <div
                      key={index}
                      className={`w-9 h-12 sm:w-11 sm:h-14 rounded-lg flex items-center justify-center text-xl sm:text-2xl font-bold border transition-all ${
                        char !== '_'
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                          : 'bg-white/5 border-white/10 text-transparent'
                      }`}
                    >
                      {char}
                    </div>
                  ))}
                </div>

                <div className="text-xs font-mono-code text-slate-400 tracking-wider uppercase mb-2">
                  Category: <span className="text-yellow-400 font-bold">Tech & Gaming</span> • Lives Left: <span className="text-red-400 font-bold">2 / 6</span>
                </div>
              </div>

              {/* Player Indicators at Bottom */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10">
                {/* Player 1 */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-display font-bold text-sm">
                    P1
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">Player 1 (Guesser)</div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <div className="w-9 h-9 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-display font-bold text-sm">
                    P2
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">Player 2 (Setter)</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Word Locked</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ─── 3. STATS BAR ───────────────────────────────────────────── */}
      <section className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Stat 1: Cyan */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-cyan-500/30 transition-all duration-300">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] mb-1">
              12,480
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
              Duels Played
            </div>
          </div>

          {/* Stat 2: Purple */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-purple-500/30 transition-all duration-300">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] mb-1">
              3,920
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
              Active Duelists
            </div>
          </div>

          {/* Stat 3: Green */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-emerald-500/30 transition-all duration-300">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] mb-1">
              98%
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
              Match Uptime
            </div>
          </div>

          {/* Stat 4: Yellow */}
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-yellow-500/30 transition-all duration-300">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)] mb-1">
              24/7
            </div>
            <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
              Instant Matchmaking
            </div>
          </div>

        </div>
      </section>

      {/* ─── 4. FEATURES GRID ("WHY DUEL HERE") ──────────────────────── */}
      <section id="features" className="relative z-10 py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="font-mono-code text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
            WHY DUEL HERE
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight">
            Built for word nerds who love a fight
          </h2>
          <p className="mt-4 text-slate-400 text-base sm:text-lg">
            Every feature is fine-tuned for lightning speed, zero lag, and competitive tension.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Real-Time Duels */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              Real-Time Duels
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Instant WebSockets sync letter-by-letter. See your opponent guess in real-time with zero lag or delay.
            </p>
          </div>

          {/* Card 2: PvE Mode */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              PvE Mode
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Solo training against an adaptive computer opponent with Easy, Medium, and Master difficulty tiers.
            </p>
          </div>

          {/* Card 3: Room Codes */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              Room Codes
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Generate 4-letter private game codes with a single click. Share via Discord, WhatsApp, or instant link.
            </p>
          </div>

          {/* Card 4: Fast Rounds */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-yellow-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-yellow-600/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              Fast Rounds
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Snappy 60-second word setting and rapid-fire guessing timers keep matches energetic and competitive.
            </p>
          </div>

          {/* Card 5: Live Leaderboard */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-fuchsia-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              Live Leaderboard
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Track duel win streaks, accuracy scores, and round times with automated end-of-game performance dialogues.
            </p>
          </div>

          {/* Card 6: Advanced Settings */}
          <div className="p-7 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-rose-500/40 hover:bg-white/[0.05] transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
              Advanced Settings
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Customize host round duration, toggle curated suggestion pools, or allow custom user-crafted puzzle words.
            </p>
          </div>

        </div>
      </section>

      {/* ─── 5. HOW TO PLAY ("GET IN THE RING") ───────────────────────── */}
      <section id="how-to-play" className="relative z-10 py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="font-mono-code text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
            GET IN THE RING
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight">
            How to Duel in 3 Simple Steps
          </h2>
          <p className="mt-4 text-slate-400 text-base sm:text-lg">
            No signup, no downloads. Just pick your alias and jump into the gallows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Step 01 */}
          <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="font-mono-code text-5xl font-black text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              01
            </div>
            <h3 className="font-display text-2xl font-bold uppercase text-white mb-3 tracking-wide">
              Set your name
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Enter your duelist handle. No registration required — you get instant access to live lobbies and match stats.
            </p>
          </div>

          {/* Step 02 */}
          <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="font-mono-code text-5xl font-black text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              02
            </div>
            <h3 className="font-display text-2xl font-bold uppercase text-white mb-3 tracking-wide">
              Create or join
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Spin up a room to get a 4-letter code, send it to your friend, or enter an existing code to challenge a host.
            </p>
          </div>

          {/* Step 03 */}
          <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <div className="font-mono-code text-5xl font-black text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">
              03
            </div>
            <h3 className="font-display text-2xl font-bold uppercase text-white mb-3 tracking-wide">
              Guess to win
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Take turns setting and guessing hidden words. Uncover the secret before the 6th limb hangs to take the crown!
            </p>
          </div>

        </div>
      </section>

      {/* ─── 6. SPLIT SHOWCASE ("TWO WAYS TO PLAY") ───────────────────── */}
      <section id="modes" className="relative z-10 py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copy & CTA */}
          <div className="lg:col-span-6">
            <div className="font-mono-code text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
              TWO WAYS TO PLAY
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight mb-6">
              Duel a friend, or beat the machine
            </h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-6">
              Whether you want high-stakes multiplayer mind games or quick solo word puzzle practice on the go, Hangman Duel has you covered.
            </p>

            <ul className="space-y-4 mb-8 text-sm sm:text-base text-slate-300">
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 text-xs">
                  ✓
                </div>
                <span><strong>Multiplayer 1v1:</strong> Custom words, suggestions & revenge rematches.</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 text-xs">
                  ✓
                </div>
                <span><strong>Single-Player PvE:</strong> Smart dictionary engine with clue hints.</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs">
                  ✓
                </div>
                <span><strong>Cross-Platform:</strong> Seamless on Mobile, Tablet, and Desktop.</span>
              </li>
            </ul>

            <button
              onClick={onPlayNow || (() => {})}
              className="px-8 py-4 rounded-xl font-display font-bold text-base uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-purple-600 shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 flex items-center gap-3"
            >
              <span>Start a Duel</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          {/* Right Column: Sleek Mock UI Card for PvE Mode */}
          <div className="lg:col-span-6">
            <div className="relative">
              {/* Backlight */}
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/30 to-violet-600/30 rounded-3xl blur-xl opacity-60" />
              
              <div className="relative bg-[#11101d] border border-white/15 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="font-display font-bold text-sm tracking-wider uppercase text-cyan-300">
                      PvE Training Mode
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-white/10 font-mono-code text-xs font-bold text-yellow-400">
                      ROUND 3
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 font-mono-code text-xs font-bold text-red-400">
                      DIFFICULTY: HARD
                    </span>
                  </div>
                </div>

                {/* Word Display: P _ X _ L */}
                <div className="text-center my-6">
                  <div className="text-xs font-mono-code text-slate-400 uppercase tracking-widest mb-3">
                    Secret Word (5 Letters)
                  </div>
                  <div className="flex items-center justify-center gap-3 font-mono-code">
                    {revealedChars.map((char, index) => (
                      <div
                        key={index}
                        className={`w-11 h-14 sm:w-12 sm:h-16 rounded-xl flex items-center justify-center text-2xl font-bold border ${
                          char !== '_'
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                            : 'bg-white/5 border-white/10 text-white/20'
                        }`}
                      >
                        {char}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lives tracker */}
                <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 mb-6 font-mono-code text-xs">
                  <span className="text-slate-400">Gallows Health:</span>
                  <div className="flex items-center gap-1.5 text-red-400">
                    <span>❤️</span>
                    <span>❤️</span>
                    <span>❤️</span>
                    <span className="opacity-30">🖤</span>
                    <span className="opacity-30">🖤</span>
                    <span className="opacity-30">🖤</span>
                    <span className="ml-2 text-slate-300 font-bold">(3/6 Lives)</span>
                  </div>
                </div>

                {/* Interactive Mock Keyboard Grid */}
                <div className="space-y-2">
                  <div className="text-xs font-mono-code text-slate-400 mb-2">
                    Interactive Virtual Keyboard (Try clicking!):
                  </div>

                  {/* Row 1 */}
                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => {
                      const state = guessedLetters[key];
                      return (
                        <button
                          key={key}
                          onClick={() => handleMockKeyClick(key)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all ${
                            state === 'correct'
                              ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-95'
                              : state === 'wrong'
                              ? 'bg-red-600/30 text-red-400 border border-red-500/40 line-through opacity-60'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95'
                          }`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 2 */}
                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => {
                      const state = guessedLetters[key];
                      return (
                        <button
                          key={key}
                          onClick={() => handleMockKeyClick(key)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all ${
                            state === 'correct'
                              ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-95'
                              : state === 'wrong'
                              ? 'bg-red-600/30 text-red-400 border border-red-500/40 line-through opacity-60'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95'
                          }`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>

                  {/* Row 3 */}
                  <div className="flex justify-center gap-1.5 sm:gap-2">
                    {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => {
                      const state = guessedLetters[key];
                      return (
                        <button
                          key={key}
                          onClick={() => handleMockKeyClick(key)}
                          className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all ${
                            state === 'correct'
                              ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-95'
                              : state === 'wrong'
                              ? 'bg-red-600/30 text-red-400 border border-red-500/40 line-through opacity-60'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white hover:scale-105 active:scale-95'
                          }`}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── 7. FINAL CTA & FOOTER ───────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Glow backdrop */}
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/15 via-fuchsia-600/15 to-cyan-600/15 blur-3xl rounded-3xl -z-10" />

        <div className="p-10 sm:p-16 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl relative">
          
          {/* Small Yellow Skull Icon */}
          <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 mx-auto flex items-center justify-center text-yellow-400 mb-6 shadow-sm shadow-yellow-500/20">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Blocky Headline */}
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight mb-4">
            Your stickman is waiting.
          </h2>

          <p className="max-w-xl mx-auto text-slate-400 text-base sm:text-lg mb-8">
            Jump into a live match right now. No downloads, no registration required.
          </p>

          {/* Final Purple Gradient CTA */}
          <button
            onClick={onPlayNow || (() => { window.scrollTo({ top: 0, behavior: 'smooth' }); })}
            className="px-10 py-5 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-purple-600/40 hover:shadow-purple-500/60 hover:scale-[1.04] active:scale-[0.98] transition-all duration-200 inline-flex items-center gap-3"
          >
            <span>Play Hangman Duel</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-4 sm:px-6 lg:px-8 bg-[#07070d]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-base uppercase text-white tracking-wider">
              Hangman <span className="text-purple-400">Duel</span>
            </span>
            <span className="text-xs text-slate-500">• Real-Time Word Showdown</span>
          </div>

          <div className="text-xs text-white/40 font-mono-code">
            © {new Date().getFullYear()} Hangman Duel. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
