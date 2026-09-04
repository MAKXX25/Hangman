'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { playMechanicalClick } from '../lib/audio.js';

// Gentle web audio synthesizer for neon sound effects (no external assets needed)
function playTone(freq = 440, type = 'sine', duration = 0.15, vol = 0.08) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__hangmanAudioCtx) {
      window.__hangmanAudioCtx = new AudioCtx();
    }
    const ctx = window.__hangmanAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

const CHIME_FREQS = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 523.25]; // C D E F G A C (Major scale)

const QUIPS = [
  "Wheee! Nice swing!",
  "Hey! Watch the rope!",
  "Stop tickling me!",
  "I'm dizzy! Guess a letter!",
  "Whoa! That's high!",
  "10/10 pendulum physics!",
  "Save me, don't shake me!",
  "Hold on to your letters!",
  "I'm just hanging around!"
];

export default function InteractiveHeroCard({ onPlayNow }) {
  const cardRef = useRef(null);
  const gallowsRef = useRef(null);

  // 3D Card Tilt on Mouse Move
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Pendulum Swing Physics State
  const [angle, setAngle] = useState(0); // in degrees
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, initialAngle: 0 });

  // Stickman Hover / Gaze reaction
  const [hoverLean, setHoverLean] = useState(0);
  const [speech, setSpeech] = useState(null);
  const speechTimerRef = useRef(null);

  // Letter interaction state
  const [bouncedIndex, setBouncedIndex] = useState(null);
  const [rainbowMode, setRainbowMode] = useState(false);

  // Header status state
  const [roomStatus, setRoomStatus] = useState("LIVE MATCH");
  const [p1Text, setP1Text] = useState("Thinking…");
  const [p2Text, setP2Text] = useState("Word Locked");

  // Physics animation loop using Spring/Pendulum equations
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const updatePhysics = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05); // cap dt
      lastTime = now;

      if (!isDraggingRef.current) {
        // Pendulum: gravity + damping
        const gravity = 80; // acceleration
        const damping = 0.965; // air drag
        const restoringForce = -gravity * Math.sin((angleRef.current * Math.PI) / 180);

        velocityRef.current = (velocityRef.current + restoringForce * dt * 60) * damping;
        angleRef.current += velocityRef.current * dt * 40;

        // Threshold clamping when nearly still
        if (Math.abs(angleRef.current) < 0.1 && Math.abs(velocityRef.current) < 0.2) {
          angleRef.current = 0;
          velocityRef.current = 0;
        }

        setAngle(angleRef.current);
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, []);

  const triggerSpeech = (customText = null) => {
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    const text = customText || QUIPS[Math.floor(Math.random() * QUIPS.length)];
    setSpeech(text);
    speechTimerRef.current = setTimeout(() => {
      setSpeech(null);
    }, 2800);
  };

  // Card 3D Tilt on Hover
  const handleCardMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -7; // max -7 to 7 deg
    const rotateY = ((x - centerX) / centerX) * 7;
    setTilt({ x: rotateX, y: rotateY });
  };

  const handleCardMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHoverLean(0);
  };

  // Dragging the stickman
  const handleGallowsMouseDown = (e) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialAngle: angleRef.current
    };
    velocityRef.current = 0;
    playTone(320, 'triangle', 0.1, 0.06);

    const onMouseMove = (moveEvent) => {
      if (!isDraggingRef.current || !gallowsRef.current) return;
      const rect = gallowsRef.current.getBoundingClientRect();
      const pivotX = rect.left + rect.width * 0.65; // top beam anchor
      const pivotY = rect.top + 20;

      const dx = moveEvent.clientX - pivotX;
      const dy = moveEvent.clientY - pivotY;
      let newAngle = (Math.atan2(dx, dy) * 180) / Math.PI;

      // Clamp max swing angle to ±55 degrees
      newAngle = Math.max(-55, Math.min(55, newAngle));
      angleRef.current = newAngle;
      setAngle(newAngle);
    };

    const onMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Impart impulse based on final angle
        velocityRef.current = -angleRef.current * 1.8;
        playTone(520, 'sine', 0.2, 0.08);
        triggerSpeech();
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Touch event support for smartphones & tablets
  const handleTouchStart = (e) => {
    if (!e.touches[0] || !gallowsRef.current) return;
    isDraggingRef.current = true;
    playTone(320, 'triangle', 0.1, 0.06);

    const onTouchMove = (touchEvent) => {
      if (!isDraggingRef.current || !gallowsRef.current || !touchEvent.touches[0]) return;
      const touch = touchEvent.touches[0];
      const rect = gallowsRef.current.getBoundingClientRect();
      const pivotX = rect.left + rect.width * 0.65;
      const pivotY = rect.top + 20;

      const dx = touch.clientX - pivotX;
      const dy = touch.clientY - pivotY;
      let newAngle = (Math.atan2(dx, dy) * 180) / Math.PI;
      newAngle = Math.max(-55, Math.min(55, newAngle));
      angleRef.current = newAngle;
      setAngle(newAngle);
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
      velocityRef.current = -angleRef.current * 1.8;
      playTone(520, 'sine', 0.2, 0.08);
      triggerSpeech();
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  // Hovering around stickman creates subtle interactive gaze
  const handleStickmanHover = (e) => {
    if (isDraggingRef.current || !gallowsRef.current) return;
    const rect = gallowsRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const offset = (e.clientX - centerX) / (rect.width / 2);
    setHoverLean(offset * 6); // subtle lean towards mouse
  };

  // Letter Tile Interaction
  const handleLetterHover = (index) => {
    setBouncedIndex(index);
    playTone(CHIME_FREQS[index % CHIME_FREQS.length], 'sine', 0.12, 0.07);
  };

  const handleLetterClick = (index, char) => {
    setBouncedIndex(index);
    playMechanicalClick();
    playTone(CHIME_FREQS[index % CHIME_FREQS.length] * 1.5, 'triangle', 0.25, 0.12);
    // Trigger stickman comment
    triggerSpeech(`Letter "${char}"? You got it!`);
  };

  const handleToggleParty = () => {
    setRainbowMode(prev => !prev);
    playTone(880, 'sine', 0.3, 0.15);
    triggerSpeech(rainbowMode ? "Party mode OFF!" : "🎉 PARTY MODE ON! Let's duel!");
  };

  const letters = ['H', 'A', 'N', 'G', 'M', 'A', 'N'];
  const totalSwing = angle + hoverLean;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleCardMouseMove}
      onMouseLeave={handleCardMouseLeave}
      className="relative flex flex-col justify-between w-full h-full transition-transform duration-200 ease-out select-none"
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Dynamic Animated Ambient Glow */}
      <div className={`absolute -inset-1 rounded-3xl blur-xl opacity-75 transition-all duration-500 ${
        rainbowMode
          ? 'bg-gradient-to-r from-pink-500 via-amber-400 via-emerald-400 to-cyan-400 animate-pulse'
          : 'bg-gradient-to-r from-violet-600/40 via-cyan-500/30 to-purple-600/40'
      }`} />

      {/* Main Glassmorphic Card Container */}
      <div className="relative bg-[#11101d]/95 border border-white/15 rounded-3xl p-5 sm:p-7 backdrop-blur-2xl shadow-2xl text-left w-full flex-1 flex flex-col justify-between overflow-hidden">
        
        {/* Interactive Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            {/* Clickable Window Traffic Lights */}
            <button
              type="button"
              onClick={() => triggerSpeech("Ouch! Don't close the room!")}
              className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 hover:scale-125 transition-transform cursor-pointer shadow-sm shadow-red-500/50"
              title="Close Room"
            />
            <button
              type="button"
              onClick={() => {
                velocityRef.current += (Math.random() > 0.5 ? 25 : -25);
                triggerSpeech("Whoosh! Sudden gust of wind!");
                playTone(400, 'sawtooth', 0.15, 0.05);
              }}
              className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-400 hover:scale-125 transition-transform cursor-pointer shadow-sm shadow-yellow-500/50"
              title="Give Stickman a Gust of Wind"
            />
            <button
              type="button"
              onClick={handleToggleParty}
              className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-400 hover:scale-125 transition-transform cursor-pointer shadow-sm shadow-green-500/50"
              title="Toggle Party Neon Mode"
            />
            <span className="ml-2 font-mono-code text-[11px] sm:text-xs text-slate-400 tracking-wider">
              ROOM #DUEL-894
            </span>
          </div>

          {/* Clickable Live Status Badge */}
          <button
            type="button"
            onClick={() => {
              setRoomStatus(prev => (prev === "LIVE MATCH" ? "YOU'RE NEXT! 🔥" : "LIVE MATCH"));
              playTone(600, 'sine', 0.15, 0.08);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-xs font-mono-code font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Click to toggle status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>{roomStatus}</span>
          </button>
        </div>

        {/* Center Gallows & Pendulum Stickman */}
        <div
          ref={gallowsRef}
          onMouseMove={handleStickmanHover}
          className="relative flex flex-col items-center justify-center my-auto py-2"
        >
          {/* Interactive Cue Badge on Hover */}
          <div className="text-[10px] font-mono-code text-cyan-400/80 uppercase tracking-widest mb-1 flex items-center gap-1">
            <span>👆</span>
            <span>Click & Drag or Shake Stickman</span>
          </div>

          {/* Speech Bubble when Swung / Clicked */}
          {speech && (
            <div className="absolute top-1 z-30 px-3 py-1.5 rounded-xl bg-purple-950/90 border border-purple-400/60 text-purple-200 text-xs font-mono-code font-bold shadow-lg shadow-purple-500/30 animate-bounce pointer-events-none text-center max-w-[210px]">
              &ldquo;{speech}&rdquo;
            </div>
          )}

          {/* Gallows SVG with Dynamic Swinging Pendulum Group */}
          <div
            className="w-36 h-32 sm:w-44 sm:h-36 relative flex items-center justify-center cursor-grab active:cursor-grabbing"
            onMouseDown={handleGallowsMouseDown}
            onTouchStart={handleTouchStart}
            title="Click and drag to swing the hangman!"
          >
            <svg
              className="w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              viewBox="0 0 100 90"
              fill="none"
              stroke="#c084fc"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Static Gallows Timber Frame */}
              <path d="M15 85 L85 85" stroke="#7c3aed" strokeWidth="4" />
              <path d="M30 85 L30 10 L65 10 L65 18" stroke="#7c3aed" strokeWidth="3.5" />
              <path d="M30 25 L45 10" stroke="#7c3aed" strokeWidth="2.5" />

              {/* Dynamic Swinging Stickman (Pivot anchored at beam tip x=65, y=18) */}
              <g
                style={{
                  transformOrigin: '65px 18px',
                  transform: `rotate(${totalSwing}deg)`,
                  transition: isDraggingRef.current ? 'none' : 'transform 0.05s linear'
                }}
              >
                {/* Noose Rope */}
                <line x1="65" y1="18" x2="65" y2="24" stroke="#e9d5ff" strokeWidth="2.5" strokeDasharray="2,2" />

                {/* Head with Neon Glow */}
                <circle
                  cx="65"
                  cy="32"
                  r="8"
                  stroke={rainbowMode ? "#f43f5e" : "#38bdf8"}
                  strokeWidth="3"
                  className="filter drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]"
                />

                {/* Body Trunk */}
                <line
                  x1="65"
                  y1="40"
                  x2="65"
                  y2="60"
                  stroke={rainbowMode ? "#ec4899" : "#38bdf8"}
                  strokeWidth="3"
                />

                {/* Left & Right Arms (Dynamically spread when swinging) */}
                <line
                  x1="65"
                  y1="46"
                  x2={52 - totalSwing * 0.15}
                  y2={54 - Math.abs(totalSwing) * 0.1}
                  stroke={rainbowMode ? "#eab308" : "#38bdf8"}
                  strokeWidth="3"
                />
                <line
                  x1="65"
                  y1="46"
                  x2={78 - totalSwing * 0.15}
                  y2={54 + Math.abs(totalSwing) * 0.1}
                  stroke={rainbowMode ? "#eab308" : "#38bdf8"}
                  strokeWidth="3"
                />

                {/* Left & Right Legs */}
                <line
                  x1="65"
                  y1="60"
                  x2={54 - totalSwing * 0.25}
                  y2="76"
                  stroke={rainbowMode ? "#10b981" : "#38bdf8"}
                  strokeWidth="3"
                />
                <line
                  x1="65"
                  y1="60"
                  x2={76 - totalSwing * 0.25}
                  y2="76"
                  stroke={rainbowMode ? "#10b981" : "#38bdf8"}
                  strokeWidth="3"
                />
              </g>
            </svg>
          </div>

          {/* Interactive Neon Letters: H A N G M A N */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 my-3 font-mono-code">
            {letters.map((char, index) => {
              const isBounced = bouncedIndex === index;
              return (
                <button
                  key={index}
                  type="button"
                  onMouseEnter={() => handleLetterHover(index)}
                  onMouseLeave={() => setBouncedIndex(null)}
                  onClick={() => handleLetterClick(index, char)}
                  className={`w-8 h-11 sm:w-10 sm:h-13 rounded-xl flex items-center justify-center text-lg sm:text-2xl font-black uppercase transition-all duration-300 cursor-pointer select-none active:scale-90 ${
                    isBounced
                      ? 'border-2 border-yellow-300 bg-yellow-400/30 text-yellow-200 -translate-y-2.5 scale-110 shadow-[0_0_24px_rgba(250,204,21,0.85)] z-20'
                      : rainbowMode
                      ? 'border-2 border-pink-400 bg-pink-500/25 text-pink-200 shadow-[0_0_18px_rgba(244,63,94,0.6)]'
                      : 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.45)] hover:border-cyan-300 hover:shadow-[0_0_22px_rgba(34,211,238,0.7)] hover:-translate-y-1'
                  }`}
                  title={`Letter ${char} (Click or hover to chime!)`}
                >
                  {char}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] sm:text-xs font-mono-code text-slate-400 tracking-wide mt-0.5">
            Hover letters to chime • Click to trigger stickman
          </p>
        </div>

        {/* Interactive Player Badges at Bottom */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/10">
          {/* Player 1 Card */}
          <div
            onClick={() => {
              setP1Text(prev => (prev === "Thinking…" ? "Guessed 'E'! 🎯" : "Thinking…"));
              playTone(480, 'sine', 0.1, 0.08);
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-violet-500/40 transition-all cursor-pointer group"
            title="Click to interact with Player 1"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 group-hover:scale-110 flex items-center justify-center text-violet-400 font-display font-bold text-xs transition-transform">
              P1
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] sm:text-xs font-semibold text-white truncate">Player 1 (Guesser)</div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{p1Text}</span>
              </div>
            </div>
          </div>

          {/* Player 2 Card */}
          <div
            onClick={() => {
              setP2Text(prev => (prev === "Word Locked" ? "Selecting Hint… 💡" : "Word Locked"));
              playTone(540, 'sine', 0.1, 0.08);
            }}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/40 transition-all cursor-pointer group"
            title="Click to interact with Player 2"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 group-hover:scale-110 flex items-center justify-center text-cyan-400 font-display font-bold text-xs transition-transform">
              P2
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] sm:text-xs font-semibold text-white truncate">Player 2 (Setter)</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                <span>{p2Text}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
