'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { getSocket, isBackendConfigured, getBackendUrl } from '../lib/socket.js';
import { getRandomWord, isValidWord, getRandomSuggestions } from '../lib/dictionary.js';
import { getRandomFact } from '../lib/facts.js';
import {
  MAX_LIVES,
  DEFAULT_WORD_PICK_TIME,
  getHiddenWord,
  processGuess,
  getRandomPerformanceDialogue
} from '../lib/gameLogic.js';

// Keyboard layout
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

// Scramble text phrases & chars
const SCRAMBLE_PHRASES = [
  'PREPARING THE CHALLENGE',
  'WORD IS BEING CHOSEN',
  'GET READY TO GUESS',
  'STAND BY FOR THE WORD',
  'THE SETTER IS THINKING'
];
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%?&*';

// Neon palette
const NEON_GALLOWS = '#7c3aed';
const NEON_GALLOWS_GLOW = '#a855f7';
const NEON_BODY = '#c084fc';
const NEON_DEAD = '#ef4444';
const NEON_DEAD_GLOW = '#fca5a5';

export default function HangmanDuelApp() {
  // Screen state: 'lobby' | 'waiting' | 'game'
  const [screen, setScreen] = useState('lobby');
  const [playerName, setPlayerName] = useState('Player 1');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [lobbyError, setLobbyError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'waking_up' | 'connected' | 'missing_env' | 'error'
  const [toastMsg, setToastMsg] = useState('');
  const [toastKey, setToastKey] = useState(0);

  // Host Advanced Settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [wordPickTime, setWordPickTime] = useState(60);

  // PvE Single-Player Mode State
  const [showPveModal, setShowPveModal] = useState(false);
  const [isPveMode, setIsPveMode] = useState(false);
  const [pveDifficulty, setPveDifficulty] = useState('medium');
  const [pveScore, setPveScore] = useState({ human: 0, bot: 0 });
  const [pveRound, setPveRound] = useState(1);
  const [pveMaxRounds, setPveMaxRounds] = useState(5); // 3 | 5 | 10
  const [pveCountdown, setPveCountdown] = useState(null); // null | 3 | 2 | 1 | 0
  const [frozenDialogue, setFrozenDialogue] = useState(''); // Stable random text per round

  // Multiplayer Game State
  const [myPlayerId, setMyPlayerId] = useState('');
  const [gameState, setGameState] = useState('waiting'); // waiting | setting | guessing | roundover
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(60);
  const [timerTotal, setTimerTotal] = useState(60);
  const [setterWordSubmitted, setSetterWordSubmitted] = useState(false);

  // Word Setter State
  const [secretWordInput, setSecretWordInput] = useState('');
  const [wordValidationMsg, setWordValidationMsg] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Facts & Scramble State
  const [currentGuesserFact, setCurrentGuesserFact] = useState('');
  const [guesserFactFade, setGuesserFactFade] = useState(false);
  const [currentWatchFact, setCurrentWatchFact] = useState('');
  const [watchFactFade, setWatchFactFade] = useState(false);
  const [scrambleText, setScrambleText] = useState('');

  // Environmental effects
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [isScreenFlashing, setIsScreenFlashing] = useState(false);
  const [isGallowsSwinging, setIsGallowsSwinging] = useState(false);

  // Round Over Modal State
  const [isRoundOverModalOpen, setIsRoundOverModalOpen] = useState(false);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState(false);

  // Animation tracking
  const [newlyGuessedLetters, setNewlyGuessedLetters] = useState([]);
  const [newlyWrongLetters, setNewlyWrongLetters] = useState([]);
  const prevGuessedRef = useRef([]);
  const prevWrongRef = useRef([]);

  // Score Celebration Animation State & Refs
  const [p1Scored, setP1Scored] = useState(false);
  const [p2Scored, setP2Scored] = useState(false);
  const prevP1ScoreRef = useRef(null);
  const prevP2ScoreRef = useRef(null);
  const p1ScoreTimerRef = useRef(null);
  const p2ScoreTimerRef = useRef(null);

  // Canvas Drawing Refs
  const hangmanCanvasRef = useRef(null);
  const hangmanWatchCanvasRef = useRef(null);
  const canvasAnimStateRef = useRef({ drawnSteps: 0, animId: null });
  const watchCanvasAnimStateRef = useRef({ drawnSteps: 0, animId: null });
  const specialAnimIdRef = useRef(null);

  // Auxiliary Refs
  const socketRef = useRef(null);
  const wakeUpTimerRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const particleAnimRef = useRef(null);
  const scrambleIntervalRef = useRef(null);
  const factsIntervalRef = useRef(null);
  const watchFactsIntervalRef = useRef(null);
  const currentRoundTokenRef = useRef(0);

  // Anti-Repetition Shuffle Bag Tracking
  const usedWordsRef = useRef([]);
  const usedGuesserFactsRef = useRef([]);
  const usedWatchFactsRef = useRef([]);

  // Show Toast Helper
  const showToast = useCallback((msg, duration = 2500) => {
    setToastMsg(msg);
    setToastKey(prev => prev + 1);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg('');
    }, duration);
  }, []);

  // ── Confetti Shower Trigger ───────────────────────────────────────────────
  const triggerConfettiShower = useCallback(() => {
    const colors = ['#a855f7', '#7c3aed', '#06b6d4', '#22d3ee', '#10b981', '#34d399', '#f43f5e', '#facc15'];
    try {
      // Bottom left cannon
      confetti({
        particleCount: 75,
        angle: 60,
        spread: 80,
        origin: { x: 0.05, y: 0.9 },
        colors,
        zIndex: 9999
      });
      // Bottom right cannon
      confetti({
        particleCount: 75,
        angle: 120,
        spread: 80,
        origin: { x: 0.95, y: 0.9 },
        colors,
        zIndex: 9999
      });

      // Ceiling burst series across 2.5 seconds
      const end = Date.now() + 2500;
      const interval = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }
        confetti({
          particleCount: 40,
          startVelocity: 25,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.1 },
          colors,
          zIndex: 9999
        });
      }, 250);
    } catch {}
  }, []);

  // ── Canvas Glow & Pen Spark Helpers ───────────────────────────────────────
  const applyGlow = (ctx, color, blur = 10) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  };
  const clearGlow = (ctx) => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  };
  const drawPenTip = (ctx, x, y, glowColor) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = glowColor || '#06b6d4';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // ── Draw Progressive Stroke Step ──────────────────────────────────────────
  const drawProgressiveStep = useCallback((ctx, stepIndex, progress, isDead, withTip = true) => {
    const p = Math.max(0, Math.min(1, progress));
    if (p === 0) return;

    switch (stepIndex) {
      case 0: { // 1: Base
        const x1 = 15, y1 = 225, x2 = 185, y2 = 225;
        const curX = x1 + p * (x2 - x1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_GALLOWS;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW, 12);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, y2);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, curX, y2, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW);
        break;
      }
      case 1: { // 2: Vertical Pole
        const x1 = 55, y1 = 225, x2 = 55, y2 = 18;
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_GALLOWS;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW, 12);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, x1, curY, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW);
        break;
      }
      case 2: { // 3: Top line / Beam
        const x1 = 55, y1 = 18, x2 = 145, y2 = 18;
        const curX = x1 + p * (x2 - x1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_GALLOWS;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW, 12);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, y1);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, curX, y1, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW);
        break;
      }
      case 3: { // 4: Rope
        const x1 = 145, y1 = 18, x2 = 145, y2 = 44;
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW, 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, x1, curY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        break;
      }
      case 4: { // 5: Head
        const cx = 145, cy = 64, r = 20;
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + p * (Math.PI * 2);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 14);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) {
          const tipX = cx + r * Math.cos(endAngle);
          const tipY = cy + r * Math.sin(endAngle);
          drawPenTip(ctx, tipX, tipY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        }
        break;
      }
      case 5: { // 6: Body / Torso
        const x1 = 145, y1 = 84, x2 = 145, y2 = 148;
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 10);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, x1, curY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        break;
      }
      case 6: { // 7: Left Arm
        const x1 = 145, y1 = 100, x2 = 112, y2 = 130;
        const curX = x1 + p * (x2 - x1);
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 10);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, curX, curY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        break;
      }
      case 7: { // 8: Right Arm
        const x1 = 145, y1 = 100, x2 = 178, y2 = 130;
        const curX = x1 + p * (x2 - x1);
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 10);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, curX, curY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        break;
      }
      case 8: { // 9: Left Leg
        const x1 = 145, y1 = 148, x2 = 112, y2 = 195;
        const curX = x1 + p * (x2 - x1);
        const curY = y1 + p * (y2 - y1);
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 10);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(curX, curY);
        ctx.stroke();
        clearGlow(ctx);
        if (withTip && p < 1) drawPenTip(ctx, curX, curY, isDead ? NEON_DEAD_GLOW : NEON_BODY);
        break;
      }
      case 9: { // 10: Right Leg + X Eyes
        const x1 = 145, y1 = 148, x2 = 178, y2 = 195;
        ctx.strokeStyle = NEON_DEAD;
        applyGlow(ctx, NEON_DEAD_GLOW, 14);
        ctx.lineWidth = 3.5;

        if (p <= 0.65) {
          const legP = p / 0.65;
          const curX = x1 + legP * (x2 - x1);
          const curY = y1 + legP * (y2 - y1);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(curX, curY);
          ctx.stroke();
          clearGlow(ctx);
          if (withTip) drawPenTip(ctx, curX, curY, NEON_DEAD_GLOW);
        } else {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          clearGlow(ctx);

          // Draw X eyes fading in
          const eyeAlpha = (p - 0.65) / 0.35;
          ctx.save();
          ctx.globalAlpha = eyeAlpha;
          applyGlow(ctx, NEON_DEAD_GLOW, 10);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = NEON_DEAD;
          // left X
          ctx.beginPath();
          ctx.moveTo(135, 57); ctx.lineTo(141, 63);
          ctx.moveTo(141, 57); ctx.lineTo(135, 63);
          ctx.stroke();
          // right X
          ctx.beginPath();
          ctx.moveTo(149, 57); ctx.lineTo(155, 63);
          ctx.moveTo(155, 57); ctx.lineTo(149, 63);
          ctx.stroke();
          clearGlow(ctx);
          ctx.restore();
        }
        break;
      }
    }
  }, []);

  const drawStaticStep = useCallback((ctx, stepIndex, isDead) => {
    drawProgressiveStep(ctx, stepIndex, 1.0, isDead, false);
  }, [drawProgressiveStep]);

  // ── Animated Stroke-by-Stroke Drawing Engine (400ms per mistake) ──────────
  const animateHangmanDrawing = useCallback((canvas, animStateRef, livesLeft, maxLives = 10, animate = true) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const targetSteps = Math.min(Math.max(0, maxLives - livesLeft), 10);
    const isDead = livesLeft <= 0;
    const state = animStateRef.current;

    if (state.animId) {
      cancelAnimationFrame(state.animId);
      state.animId = null;
    }

    // Instant render if resetting or disabled
    if (targetSteps === 0 || targetSteps < state.drawnSteps || !animate) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (targetSteps > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < targetSteps; i++) {
          drawStaticStep(ctx, i, isDead);
        }
        ctx.restore();
      }
      state.drawnSteps = targetSteps;
      return;
    }

    if (targetSteps === state.drawnSteps) return;

    let currentStep = state.drawnSteps;
    const STEP_DURATION = 400; // ms per stroke

    function animateNextStep() {
      if (currentStep >= targetSteps) {
        state.drawnSteps = targetSteps;
        state.animId = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < targetSteps; i++) {
          drawStaticStep(ctx, i, isDead);
        }
        ctx.restore();
        return;
      }

      const stepIdx = currentStep;
      const startTime = performance.now();

      function stepFrame(now) {
        const elapsed = now - startTime;
        const rawProgress = Math.min(1, elapsed / STEP_DURATION);
        const progress = 1 - Math.pow(1 - rawProgress, 3); // cubic ease-out

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Static completed lines
        for (let i = 0; i < stepIdx; i++) {
          drawStaticStep(ctx, i, isDead);
        }

        // 2. Active line being traced with glowing pen tip spark
        drawProgressiveStep(ctx, stepIdx, progress, isDead, true);

        ctx.restore();

        if (rawProgress < 1) {
          state.animId = requestAnimationFrame(stepFrame);
        } else {
          currentStep++;
          animateNextStep();
        }
      }

      state.animId = requestAnimationFrame(stepFrame);
    }

    animateNextStep();
  }, [drawProgressiveStep, drawStaticStep]);


  // ── 5-Stage Physics Death Sequence Animation (~3.5s total) ────────────────
  //
  //  Stage 1 [0.00 – 0.30s] Trapdoor Drop      – base splits with hinge physics
  //  Stage 2 [0.30 – 0.50s] Sudden Drop + Jerk – body drops, rope jerks taut
  //  Stage 3 [0.50 – 2.50s] Pendulum Ragdoll   – θ(t) = θ_max·e^(−γt)·cos(ωt)
  //  Stage 4 [2.50 – 3.20s] Rope Snap + Fall   – frayed stub, gravity free-fall
  //  Stage 5 [3.20s+]       Modal Trigger       – only after body leaves canvas
  const runDeathAnimation = useCallback((canvas, callback) => {
    if (!canvas) { callback?.(); return; }
    const ctx = canvas.getContext('2d');

    // ── Timing constants (seconds) ────────────────────────────────────────
    const T_DROP_START   = 0.30;  // trapdoor fully open, body starts to fall
    const T_JERK         = 0.50;  // rope goes taut — impact jerk
    const T_SWING_END    = 2.50;  // pendulum comes to rest
    const T_SNAP         = 2.50;  // rope snaps
    const T_FALL_END     = 3.20;  // body exits canvas bottom
    const T_MODAL        = 3.50;  // modal fires

    // ── Gallows geometry ──────────────────────────────────────────────────
    const ANCHOR_X       = 145;   // rope attach point on beam (px)
    const ANCHOR_Y       = 18;
    const ROPE_LENGTH    = 36;    // natural rope length (px)
    const CANVAS_H       = canvas.height || 250;

    // ── Pendulum physics: θ(t) = θ_max · e^(−γt) · cos(ωt) ─────────────
    const THETA_MAX      = 0.32;  // ~18° initial swing arc (radians)
    const GAMMA          = 1.05;  // damping coefficient
    const OMEGA          = 6.5;   // angular frequency (rad/s)

    const token = currentRoundTokenRef.current;
    const startTime = performance.now();
    let callbackFired = false;

    // ── Per-limb ragdoll offsets (secondary motion lag) ──────────────────
    // These are multiplied by swingAngle to give limbs a 1-frame lag feel.
    const ARM_LAG_SCALE  = 3.5;
    const LEG_LAG_SCALE  = 2.8;

    // ── Draws the complete rigged stickman centred at (0, 0) ─────────────
    // Origin = top of neck / rope attachment. Body hangs downward.
    function drawRagdoll(ctx, swingAngle, jerkCompress = 0) {
      const compress = 1 - jerkCompress * 0.08; // spine compression on impact

      // Head – tilted slightly toward rope-knot side
      const headTilt = 0.18 + swingAngle * 0.3;
      ctx.save();
      ctx.rotate(headTilt);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -18, 18, 0, Math.PI * 2);
      ctx.stroke();
      // X Eyes
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -25); ctx.lineTo(-4, -19);
      ctx.moveTo(-4,  -25); ctx.lineTo(-10, -19);
      ctx.moveTo( 4,  -25); ctx.lineTo( 10, -19);
      ctx.moveTo( 10, -25); ctx.lineTo(  4, -19);
      ctx.stroke();
      ctx.restore();

      // Torso – compressed on impact jerk
      const torsoLen = 64 * compress;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, torsoLen);
      ctx.stroke();

      // Arms – hang loosely downward with ~17° inward gravity bend
      // Secondary lag offset follows swing oscillation
      const armLag  = Math.sin(swingAngle * 2.2) * ARM_LAG_SCALE;
      const armBend = 0.30; // inward bend factor (radians)
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      // Left arm: elbow bends rightward (toward centre of mass)
      ctx.moveTo(0, 16);
      ctx.lineTo(-14 + armLag, 36 + armLag * 0.4);
      ctx.lineTo(-20 + armLag, 54 + armBend * 8);
      // Right arm
      ctx.moveTo(0, 16);
      ctx.lineTo( 14 + armLag,  36 + armLag * 0.4);
      ctx.lineTo( 20 + armLag,  54 + armBend * 8);
      ctx.stroke();

      // Legs – dangle straight, slightly apart, with secondary sway
      const legLag  = Math.sin(swingAngle * 1.75) * LEG_LAG_SCALE;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(0, torsoLen);
      ctx.lineTo(-14 + legLag, torsoLen + 50);
      ctx.moveTo(0, torsoLen);
      ctx.lineTo( 14 + legLag, torsoLen + 50);
      ctx.stroke();
    }

    // ── Draws the gallows frame (static geometry) ─────────────────────────
    function drawGallows(ctx, trapdoorAngle) {
      // Vertical pole + beam
      ctx.strokeStyle = NEON_GALLOWS;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 12);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(55, 225); ctx.lineTo(55, 18); ctx.lineTo(145, 18);
      ctx.stroke();
      clearGlow(ctx);

      // Fixed base (left of hinge)
      ctx.strokeStyle = NEON_GALLOWS;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 12);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(15, 225); ctx.lineTo(95, 225);
      ctx.stroke();

      // Trapdoor panel (right of hinge, rotates downward)
      ctx.beginPath();
      ctx.moveTo(95, 225);
      ctx.lineTo(
        95 + Math.cos(trapdoorAngle) * 90,
        225 + Math.sin(trapdoorAngle) * 90
      );
      ctx.stroke();
      clearGlow(ctx);
    }

    // ── Main animation loop ───────────────────────────────────────────────
    function animate(now) {
      if (token !== currentRoundTokenRef.current) return;

      const elapsed = (now - startTime) / 1000; // seconds

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // ── Stage 1: Trapdoor hinge-physics drop ─────────────────────────
      // Opens with a cosine ease over 0.30s then stays fully open.
      const doorT      = Math.min(1, elapsed / 0.30);
      const doorAngle  = (1 - Math.cos(doorT * Math.PI / 2)) * (Math.PI * 0.44);
      drawGallows(ctx, doorAngle);

      // ── Stage 2 & 3: Rope + swinging body ────────────────────────────
      if (elapsed < T_SNAP) {

        // Stage 2: body accelerates from 0 → ROPE_LENGTH over 0.20s
        const dropT      = Math.max(0, Math.min(1, (elapsed - T_DROP_START) / 0.20));
        const easeDropT  = 1 - Math.pow(1 - dropT, 3); // cubic ease-in
        const curRope    = ROPE_LENGTH * easeDropT;

        // Impact jerk: a brief 0-to-1-to-0 pulse at the moment rope goes taut
        const jerkWin    = 0.18; // seconds the jerk lasts
        const jerkRaw    = Math.max(0, elapsed - T_JERK);
        const jerkCompress = jerkRaw < jerkWin
          ? Math.sin((jerkRaw / jerkWin) * Math.PI) // smooth half-sine pulse
          : 0;

        // Stage 3: θ(t) = θ_max · e^(−γt) · cos(ωt) — starts after jerk
        const swingT     = Math.max(0, elapsed - T_JERK);
        const theta      = THETA_MAX * Math.exp(-GAMMA * swingT) * Math.cos(OMEGA * swingT);

        // Rope attachment position along the pendulum arc
        const neckX = ANCHOR_X + Math.sin(theta) * curRope;
        const neckY = ANCHOR_Y + Math.cos(theta) * curRope;

        // Draw taut rope
        ctx.strokeStyle = NEON_DEAD;
        applyGlow(ctx, NEON_DEAD_GLOW, 10);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ANCHOR_X, ANCHOR_Y);
        ctx.lineTo(neckX, neckY);
        ctx.stroke();
        clearGlow(ctx);

        // Draw rigged ragdoll rotating as single rig around neckX/neckY
        ctx.save();
        ctx.translate(neckX, neckY);
        ctx.rotate(theta);
        ctx.strokeStyle = NEON_DEAD;
        applyGlow(ctx, NEON_DEAD_GLOW, 12);
        drawRagdoll(ctx, theta, jerkCompress);
        clearGlow(ctx);
        ctx.restore();

      } else {
        // ── Stage 4: Rope snap ──────────────────────────────────────────
        // Draw frayed stub at beam anchor (rope end left on beam)
        ctx.strokeStyle = NEON_DEAD;
        applyGlow(ctx, NEON_DEAD_GLOW, 10);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ANCHOR_X,     ANCHOR_Y);
        ctx.lineTo(ANCHOR_X - 3, ANCHOR_Y + 6);
        ctx.lineTo(ANCHOR_X + 3, ANCHOR_Y + 10);
        ctx.lineTo(ANCHOR_X - 1, ANCHOR_Y + 14);
        ctx.stroke();
        clearGlow(ctx);

        // Free-fall: y = y0 + ½ · g · t²  (g = 850 px/s² for cinematic feel)
        const fallT  = elapsed - T_SNAP;
        const fallY  = (ANCHOR_Y + ROPE_LENGTH) + 0.5 * 850 * fallT * fallT;
        const tumble = fallT * 0.42; // gentle tumble rotation (rad/s)

        // Only render body if still on-screen
        if (fallY < CANVAS_H + 200) {
          ctx.save();
          ctx.translate(ANCHOR_X, fallY);
          ctx.rotate(tumble);
          ctx.strokeStyle = NEON_DEAD;
          applyGlow(ctx, NEON_DEAD_GLOW, 12);
          // Pass swingAngle=0 — fully limp in free-fall, no secondary motion
          drawRagdoll(ctx, 0, 0);
          clearGlow(ctx);
          ctx.restore();
        }
      }

      ctx.restore();

      // ── Stage 5: Modal trigger — deferred until body is off screen ────
      const bodyY = elapsed >= T_SNAP
        ? (ANCHOR_Y + ROPE_LENGTH) + 0.5 * 850 * Math.pow(elapsed - T_SNAP, 2)
        : 0;
      const bodyOffScreen = elapsed >= T_SNAP && bodyY > CANVAS_H + 160;

      if (bodyOffScreen && !callbackFired) {
        callbackFired = true;
        // Small grace delay so the canvas is visually clear before modal appears
        setTimeout(() => callback?.(), 300);
        return; // stop rAF loop
      }

      // Hard fallback: fire modal at T_MODAL even if geometry is off
      if (elapsed >= T_MODAL && !callbackFired) {
        callbackFired = true;
        callback?.();
        return;
      }

      specialAnimIdRef.current = requestAnimationFrame(animate);
    }

    specialAnimIdRef.current = requestAnimationFrame(animate);
  }, []);

  // ── "The Great Escape" Victory Sequence Animation (~1.8s) ─────────────────
  const runEscapeAnimation = useCallback((canvas, livesLeft, maxLives, callback) => {
    if (!canvas) { callback?.(); return; }
    const ctx = canvas.getContext('2d');
    const wrongGuessesCount = maxLives - livesLeft;
    const startTime = performance.now();
    const DURATION = 1800;
    const dustParticles = [];
    const token = currentRoundTokenRef.current;

    function animate(now) {
      if (token !== currentRoundTokenRef.current) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // 1. Static gallows parts
      if (wrongGuessesCount >= 1) {
        ctx.strokeStyle = NEON_GALLOWS;
        applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(20, 225); ctx.lineTo(90, 225);
        ctx.stroke();
        clearGlow(ctx);
      }
      if (wrongGuessesCount >= 2) {
        ctx.strokeStyle = NEON_GALLOWS;
        applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(55, 225); ctx.lineTo(55, 18); ctx.lineTo(145, 18);
        ctx.stroke();
        clearGlow(ctx);
      }
      // Broken snapped rope dangling
      if (wrongGuessesCount >= 4) {
        ctx.strokeStyle = '#f59e0b';
        applyGlow(ctx, 'rgba(245, 158, 11, 0.7)', 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(145, 18); ctx.lineTo(145, 30);
        ctx.stroke();
        clearGlow(ctx);
      }

      // Ground Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 225); ctx.lineTo(canvas.width, 225);
      ctx.stroke();

      // 2. Kinematics & running stick figure
      let figX = 145;
      const groundY = 225;
      let hipY = 178;
      let legCycle = 0;
      let isRunning = false;

      if (elapsed < 350) {
        const dropP = elapsed / 350;
        hipY = 135 + dropP * dropP * 43;
      } else {
        isRunning = true;
        const runElapsed = elapsed - 350;
        figX = 145 + runElapsed * (0.18 + (runElapsed / 1000) * 0.22);
        legCycle = runElapsed * 0.022;
        hipY = 176 + Math.sin(legCycle * 2) * 3.5;
      }

      // Dust particles kick-up
      if (isRunning && Math.random() < 0.35 && dustParticles.length < 12) {
        dustParticles.push({
          x: figX - 8 + (Math.random() - 0.5) * 6,
          y: groundY - 2 + Math.random() * 4,
          vx: -(1 + Math.random() * 2),
          vy: -(0.5 + Math.random()),
          alpha: 0.8,
          radius: 1.5 + Math.random() * 2
        });
      }

      dustParticles.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        d.alpha -= 0.035;
        if (d.alpha > 0) {
          ctx.fillStyle = `rgba(168, 85, 247, ${d.alpha * 0.6})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 3. Draw Victorious Green Stick Figure
      const NEON_WIN_BODY = '#10b981';
      ctx.strokeStyle = NEON_WIN_BODY;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 14);

      const forwardTilt = isRunning ? 5 : 0;
      const neckY = hipY - 42;
      const headCy = neckY - 18;

      // Torso
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(figX + forwardTilt, neckY);
      ctx.lineTo(figX, hipY);
      ctx.stroke();

      // Head
      ctx.beginPath();
      ctx.arc(figX + forwardTilt, headCy, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Happy Smiling Face
      ctx.fillStyle = NEON_WIN_BODY;
      ctx.beginPath();
      ctx.arc(figX + forwardTilt - 5, headCy - 3, 2, 0, Math.PI * 2);
      ctx.arc(figX + forwardTilt + 5, headCy - 3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(figX + forwardTilt, headCy + 2, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();

      // Running / Raised Arms
      const shoulderY = neckY + 10;
      ctx.lineWidth = 3.5;
      if (!isRunning) {
        ctx.beginPath();
        ctx.moveTo(figX + forwardTilt, shoulderY);
        ctx.lineTo(figX - 18, shoulderY - 18);
        ctx.moveTo(figX + forwardTilt, shoulderY);
        ctx.lineTo(figX + 18, shoulderY - 18);
        ctx.stroke();
      } else {
        const arm1Angle = Math.sin(legCycle + Math.PI);
        const arm2Angle = Math.sin(legCycle);
        ctx.beginPath();
        ctx.moveTo(figX + forwardTilt, shoulderY);
        ctx.lineTo(figX + forwardTilt + Math.sin(arm1Angle) * 26 + 4, shoulderY + Math.cos(arm1Angle) * 12);
        ctx.moveTo(figX + forwardTilt, shoulderY);
        ctx.lineTo(figX + forwardTilt + Math.sin(arm2Angle) * 26 + 4, shoulderY + Math.cos(arm2Angle) * 12);
        ctx.stroke();
      }

      // Running / Landing Legs
      if (!isRunning) {
        ctx.beginPath();
        ctx.moveTo(figX, hipY); ctx.lineTo(figX - 12, groundY);
        ctx.moveTo(figX, hipY); ctx.lineTo(figX + 12, groundY);
        ctx.stroke();
      } else {
        const leg1Angle = Math.sin(legCycle);
        const leg2Angle = Math.sin(legCycle + Math.PI);
        const foot1X = figX + Math.sin(leg1Angle) * 22;
        const foot1Y = Math.min(groundY, hipY + Math.cos(leg1Angle) * 42 + 6);
        const foot2X = figX + Math.sin(leg2Angle) * 22;
        const foot2Y = Math.min(groundY, hipY + Math.cos(leg2Angle) * 42 + 6);
        ctx.beginPath();
        ctx.moveTo(figX, hipY); ctx.lineTo(foot1X, foot1Y);
        ctx.moveTo(figX, hipY); ctx.lineTo(foot2X, foot2Y);
        ctx.stroke();
      }

      clearGlow(ctx);
      ctx.restore();

      if (progress < 1) {
        specialAnimIdRef.current = requestAnimationFrame(animate);
      } else {
        callback?.();
      }
    }

    specialAnimIdRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Apply Room State Updates ──────────────────────────────────────────────
  const applyState = useCallback((roomData) => {
    if (!roomData) return;
    setGameState(roomData.state);
    if (roomData.players) setPlayers(roomData.players);
    if (roomData.timerSecondsLeft !== undefined) setTimerSecondsLeft(roomData.timerSecondsLeft);
    if (roomData.timerTotal !== undefined) setTimerTotal(roomData.timerTotal);

    if (roomData.game) {
      const g = roomData.game;
      setGame(g);

      // Track newly guessed and newly wrong letters for pop-in animations
      const currentGuessed = g.guessedLetters || [];
      const currentWrong = g.wrongGuesses || [];

      const newG = currentGuessed.filter(l => !prevGuessedRef.current.includes(l));
      const newW = currentWrong.filter(l => !prevWrongRef.current.includes(l));

      setNewlyGuessedLetters(newG);
      setNewlyWrongLetters(newW);

      // Trigger gallows swing animation on new wrong guess
      if (newW.length > 0) {
        setIsGallowsSwinging(true);
        setTimeout(() => setIsGallowsSwinging(false), 900);
      }

      prevGuessedRef.current = [...currentGuessed];
      prevWrongRef.current = [...currentWrong];

      // Draw hangman on active canvas
      if (roomData.state === 'guessing' || (roomData.state === 'roundover' && g.roundResult !== 'guesser_wins')) {
        if (hangmanCanvasRef.current) {
          animateHangmanDrawing(hangmanCanvasRef.current, canvasAnimStateRef, g.livesLeft, g.maxLives || 10, true);
        }
        if (hangmanWatchCanvasRef.current) {
          animateHangmanDrawing(hangmanWatchCanvasRef.current, watchCanvasAnimStateRef, g.livesLeft, g.maxLives || 10, true);
        }
      }
    }

    // ── Round Over Special Transitions ──────────────────────────────────────
    if (roomData.state === 'roundover') {
      currentRoundTokenRef.current++;
      const setterWon = roomData.game?.roundResult === 'setter_wins';
      const guesserWon = roomData.game?.roundResult === 'guesser_wins';
      const isSetter = roomData.game ? (roomData.game.wordSetterId === myPlayerId) : false;

      if (setterWon) {
        // 1. Environmental Screen Shake & Red Flash
        setIsScreenShaking(true);
        setIsScreenFlashing(true);
        setTimeout(() => setIsScreenShaking(false), 550);
        setTimeout(() => setIsScreenFlashing(false), 800);

        // 2. Hanging Trapdoor & Rope-Snap Physics Animation
        const activeCanvas = hangmanCanvasRef.current || hangmanWatchCanvasRef.current;
        runDeathAnimation(activeCanvas, () => {
          setIsRoundOverModalOpen(true);
        });
      } else if (guesserWon) {
        // 1. Celebration Confetti Shower for winning guesser
        if (!isSetter) {
          triggerConfettiShower();
        }
        // 2. The Great Escape Sprint Animation
        const activeCanvas = hangmanCanvasRef.current || hangmanWatchCanvasRef.current;
        runEscapeAnimation(activeCanvas, roomData.game.livesLeft, roomData.game.maxLives || 10, () => {
          setIsRoundOverModalOpen(true);
        });
      } else {
        setIsRoundOverModalOpen(true);
      }
    } else {
      setIsRoundOverModalOpen(false);
      setIsWaitingOpponent(false);
    }
  }, [myPlayerId, triggerConfettiShower, animateHangmanDrawing, runDeathAnimation, runEscapeAnimation]);

  // ── Forceful Reset / Modal Close on Round Transition (Anti-Softlock) ─────
  const forceResetRoundState = useCallback(() => {
    currentRoundTokenRef.current++;
    setIsRoundOverModalOpen(false);
    setIsWaitingOpponent(false);
    setSetterWordSubmitted(false);
    setSecretWordInput('');
    setWordValidationMsg('');
    canvasAnimStateRef.current = { drawnSteps: 0, animId: null };
    watchCanvasAnimStateRef.current = { drawnSteps: 0, animId: null };
    prevGuessedRef.current = [];
    prevWrongRef.current = [];
    setNewlyGuessedLetters([]);
    setNewlyWrongLetters([]);

    if (hangmanCanvasRef.current) {
      const ctx = hangmanCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, hangmanCanvasRef.current.width, hangmanCanvasRef.current.height);
    }
    if (hangmanWatchCanvasRef.current) {
      const ctx = hangmanWatchCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, hangmanWatchCanvasRef.current.width, hangmanWatchCanvasRef.current.height);
    }
  }, []);

  // ── Setup Socket.io Connection & Cold-Start LifeCycle ───────────────────
  useEffect(() => {
    // 1. Environment variable validation
    if (!isBackendConfigured()) {
      setConnectionStatus('missing_env');
      setLobbyError('Error: Backend URL not configured in Vercel. Please set NEXT_PUBLIC_BACKEND_URL in Vercel Environment Variables.');
      return;
    }

    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    // 2. Cold Start Wake-up Timer (5-second threshold)
    if (!socket.connected) {
      setConnectionStatus('connecting');
      wakeUpTimerRef.current = setTimeout(() => {
        if (!socket.connected) {
          console.warn('⏳ [Server Cold-Start] Backend server taking >5s to respond (Render/Railway free tier wake-up in progress).');
          setConnectionStatus('waking_up');
        }
      }, 5000);
    } else {
      setConnectionStatus('connected');
    }

    // 3. Socket.io Event Listeners with Verbose Logging
    const onConnect = () => {
      console.log(`✅ [Socket Connected] Successfully connected to backend: ${getBackendUrl()} (ID: ${socket.id})`);
      if (wakeUpTimerRef.current) clearTimeout(wakeUpTimerRef.current);
      setConnectionStatus('connected');
      setMyPlayerId(socket.id);
      setLobbyError('');
    };

    const onConnectError = (err) => {
      console.error('❌ [Socket Connect Error Details]:', {
        message: err.message,
        description: err.description,
        context: err.context,
        targetUrl: getBackendUrl(),
      });
      // Keep 'waking_up' if already triggered after 5s
      setConnectionStatus((prev) => (prev === 'waking_up' ? 'waking_up' : 'connecting'));
    };

    const onDisconnect = (reason) => {
      console.warn(`🔌 [Socket Disconnected] Reason: ${reason}`);
      setConnectionStatus('connecting');
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };

    const onRoomCreated = ({ roomCode: code }) => {
      setIsConnecting(false);
      setRoomCode(code);
      setScreen('waiting');
      setGameState('waiting');
    };

    const onGameStart = ({ roomCode: code, players: roomPlayers }) => {
      setIsConnecting(false);
      if (code) setRoomCode(code);
      if (roomPlayers) setPlayers(roomPlayers);
      setScreen('game');
      setGameState('setting');
    };

    const onStateUpdate = (roomState) => {
      if (roomState?.state && roomState.state !== 'lobby') {
        setScreen('game');
      }
      applyState(roomState);
    };

    const onTimerTick = ({ secondsLeft, total }) => {
      setTimerSecondsLeft(secondsLeft);
      setTimerTotal(total);
    };

    const onTimerExpired = () => {
      showToast('⏱ Time is up! Random word chosen automatically.', 3500);
    };

    const onRoundStarted = () => {
      forceResetRoundState();
    };

    const onRoundTransitioning = () => {
      forceResetRoundState();
    };

    const onWordSuggestions = ({ suggestions: list }) => {
      if (list?.length) setSuggestions(list);
    };

    const onWordValidation = ({ valid, reason }) => {
      if (!valid) {
        setWordValidationMsg(reason || 'Invalid word.');
        setSetterWordSubmitted(false);
      } else {
        setWordValidationMsg('');
        setSetterWordSubmitted(true);
      }
    };

    const onOpponentLeft = () => {
      showToast('⚠️ Opponent left the game.', 4000);
      setGameState('lobby');
      setScreen('waiting');
    };

    const onErrorMsg = (msg) => {
      setIsConnecting(false);
      const text = typeof msg === 'string' ? msg : msg?.message || 'An error occurred.';
      showToast(`⚠️ ${text}`, 3000);
      setLobbyError(text);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('room_created', onRoomCreated);
    socket.on('game_start', onGameStart);
    socket.on('state_update', onStateUpdate);
    socket.on('timer_tick', onTimerTick);
    socket.on('timer_expired', onTimerExpired);
    socket.on('round_started', onRoundStarted);
    socket.on('round_transitioning', onRoundTransitioning);
    socket.on('word_suggestions', onWordSuggestions);
    socket.on('word_validation', onWordValidation);
    socket.on('opponent_left', onOpponentLeft);
    socket.on('error_msg', onErrorMsg);

    return () => {
      if (wakeUpTimerRef.current) clearTimeout(wakeUpTimerRef.current);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('room_created', onRoomCreated);
      socket.off('game_start', onGameStart);
      socket.off('state_update', onStateUpdate);
      socket.off('timer_tick', onTimerTick);
      socket.off('timer_expired', onTimerExpired);
      socket.off('round_started', onRoundStarted);
      socket.off('round_transitioning', onRoundTransitioning);
      socket.off('word_suggestions', onWordSuggestions);
      socket.off('word_validation', onWordValidation);
      socket.off('opponent_left', onOpponentLeft);
      socket.off('error_msg', onErrorMsg);
    };
  }, [applyState, forceResetRoundState, showToast]);

  // ── Load Initial Suggestions and Facts (Shuffle Bag) ──────────────────────
  useEffect(() => {
    setSuggestions(getRandomSuggestions(12));
    const initialGuesserFact = getRandomFact(usedGuesserFactsRef.current);
    usedGuesserFactsRef.current.push(initialGuesserFact);
    setCurrentGuesserFact(initialGuesserFact);

    const initialWatchFact = getRandomFact(usedWatchFactsRef.current);
    usedWatchFactsRef.current.push(initialWatchFact);
    setCurrentWatchFact(initialWatchFact);
  }, []);

  // ── Guesser Waiting Animations (Particles, Scramble, Facts with Shuffle Bag) 
  useEffect(() => {
    const isGuesserWaiting = gameState === 'setting' && game && game.wordSetterId !== myPlayerId;
    const isWatcher = (gameState === 'guessing' || gameState === 'roundover') && game && game.wordSetterId === myPlayerId;

    if (isGuesserWaiting) {
      // 1. Rotating Trivia Facts with smooth fade every 7 seconds (Anti-Repetition)
      factsIntervalRef.current = setInterval(() => {
        setGuesserFactFade(true);
        setTimeout(() => {
          const fact = getRandomFact(usedGuesserFactsRef.current);
          usedGuesserFactsRef.current.push(fact);
          setCurrentGuesserFact(fact);
          setGuesserFactFade(false);
        }, 450);
      }, 7000);

      // 2. Animated Text Scramble
      let phraseIdx = 0;
      let step = 0;
      scrambleIntervalRef.current = setInterval(() => {
        const phrase = SCRAMBLE_PHRASES[phraseIdx % SCRAMBLE_PHRASES.length];
        if (step <= phrase.length) {
          const revealed = phrase.slice(0, step);
          const noise = Array.from({ length: Math.min(4, phrase.length - step) })
            .map(() => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
            .join('');
          setScrambleText(revealed + noise);
          step++;
        } else {
          step = 0;
          phraseIdx++;
        }
      }, 70);

      // 3. Floating Particle Canvas
      const canvas = particleCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const W = canvas.offsetWidth || 500;
        const H = canvas.offsetHeight || 320;
        canvas.width = W;
        canvas.height = H;
        const colors = ['rgba(124,58,237,', 'rgba(6,182,212,', 'rgba(168,85,247,', 'rgba(16,185,129,'];
        const particles = Array.from({ length: 32 }, () => ({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 1.5 + Math.random() * 3.5,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 0.15 + Math.random() * 0.5
        }));

        const loop = () => {
          ctx.clearRect(0, 0, W, H);
          particles.forEach((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + p.alpha + ')';
            ctx.shadowColor = p.color + '0.8)';
            ctx.shadowBlur = p.r * 3;
            ctx.fill();
            ctx.shadowBlur = 0;
            p.x = (p.x + p.vx + W) % W;
            p.y = (p.y + p.vy + H) % H;
          });
          particleAnimRef.current = requestAnimationFrame(loop);
        };
        loop();
      }
    } else {
      if (factsIntervalRef.current) clearInterval(factsIntervalRef.current);
      if (scrambleIntervalRef.current) clearInterval(scrambleIntervalRef.current);
      if (particleAnimRef.current) cancelAnimationFrame(particleAnimRef.current);
    }

    if (isWatcher) {
      watchFactsIntervalRef.current = setInterval(() => {
        setWatchFactFade(true);
        setTimeout(() => {
          setCurrentWatchFact(getRandomFact());
          setWatchFactFade(false);
        }, 450);
      }, 7000);
    } else {
      if (watchFactsIntervalRef.current) clearInterval(watchFactsIntervalRef.current);
    }

    return () => {
      if (factsIntervalRef.current) clearInterval(factsIntervalRef.current);
      if (scrambleIntervalRef.current) clearInterval(scrambleIntervalRef.current);
      if (watchFactsIntervalRef.current) clearInterval(watchFactsIntervalRef.current);
      if (particleAnimRef.current) cancelAnimationFrame(particleAnimRef.current);
    };
  }, [gameState, game, myPlayerId]);

  // ── Physical Keyboard Listener for Guesser ────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'guessing' || !game) return;
      if (game.wordSetterId === myPlayerId && !isPveMode) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        handleGuessLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // ── 1. Create Room (Socket.io Backend) ──────────────────────────────────
  const handleCreateRoom = () => {
    if (connectionStatus === 'missing_env') {
      setLobbyError('Error: Backend URL not configured in Vercel.');
      return;
    }
    const name = playerName.trim();
    if (!name) {
      setLobbyError('Please enter your name first.');
      return;
    }
    setLobbyError('');
    setIsPveMode(false);
    setIsConnecting(true);
    showToast('Creating room… 🎮');

    const socket = getSocket();
    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('create_room', { playerName: name, wordPickTime });
    }

    // Safety timeout to reset loading state if server is sleeping
    setTimeout(() => {
      setIsConnecting(false);
    }, 10000);
  };

  // ── 2. Join Room (Socket.io Backend) ────────────────────────────────────
  const handleJoinRoom = () => {
    if (connectionStatus === 'missing_env') {
      setLobbyError('Error: Backend URL not configured in Vercel.');
      return;
    }
    const name = playerName.trim();
    const code = (joinCode || '').replace(/\s+/g, '').trim().toUpperCase();
    if (!name) {
      setLobbyError('Please enter your name first.');
      return;
    }
    if (!code || code.length < 4) {
      setLobbyError('Enter a valid room code.');
      return;
    }
    setLobbyError('');
    setIsPveMode(false);
    setIsConnecting(true);
    showToast('Joining game room… 🎯');

    const socket = getSocket();
    if (socket) {
      if (!socket.connected) socket.connect();
      socket.emit('join_room', { roomCode: code, playerName: name });
    }

    setTimeout(() => {
      setIsConnecting(false);
    }, 10000);
  };

  // ── 3. Start PvE Single-Player vs Computer (Authentic Difficulty + Anti-Repetition) ─
  const startPveGame = (difficulty = 'medium', roundNum = 1, scoreSnapshot = null, customMaxRounds = null) => {
    const name = playerName.trim() || 'You';
    const targetMaxRounds = customMaxRounds || pveMaxRounds;
    if (customMaxRounds) setPveMaxRounds(customMaxRounds);
    setIsPveMode(true);
    setPveDifficulty(difficulty);
    setMyPlayerId('human');
    setShowPveModal(false);
    setLobbyError('');
    setPveCountdown(null);
    setFrozenDialogue('');

    // Reset countdown timer ref if running
    if (pveCountdownRef.current) {
      clearInterval(pveCountdownRef.current);
      pveCountdownRef.current = null;
    }

    // When starting a new match (Round 1), reset score & used words shuffle bag
    if (roundNum === 1) {
      setPveRound(1);
      setPveScore({ human: 0, bot: 0 });
      usedWordsRef.current = [];
    }

    const currentScore = scoreSnapshot || (roundNum === 1 ? { human: 0, bot: 0 } : pveScore);

    // Pick authentic word using Scrabble letter rarity & shuffle bag
    const wordObj = getRandomWord(difficulty, usedWordsRef.current);
    const chosenWord = (typeof wordObj === 'string' ? wordObj : wordObj.word).toUpperCase();
    const meaning = (typeof wordObj === 'object' && wordObj.meaning) ? wordObj.meaning : '';

    // Add selected word to shuffle bag tracker
    usedWordsRef.current.push(chosenWord);

    // Reset canvas drawn states
    canvasAnimStateRef.current = { drawnSteps: 0, animId: null };
    watchCanvasAnimStateRef.current = { drawnSteps: 0, animId: null };
    prevGuessedRef.current = [];
    prevWrongRef.current = [];
    setNewlyGuessedLetters([]);
    setNewlyWrongLetters([]);

    const pveRoom = {
      roomCode: `SOLO-${difficulty.toUpperCase()}`,
      state: 'guessing',
      players: [
        { id: 'human', name: name, score: currentScore.human, isYou: true },
        { id: 'bot', name: 'Computer 🤖', score: currentScore.bot, isYou: false }
      ],
      game: {
        word: chosenWord,
        meaning: meaning,
        hiddenWord: getHiddenWord(chosenWord, []),
        guessedLetters: [],
        wrongGuesses: [],
        livesLeft: MAX_LIVES,
        maxLives: MAX_LIVES,
        wordSetterId: 'bot',
        guesserId: 'human',
        setterName: 'Computer 🤖',
        guesserName: name,
        roundResult: null
      }
    };

    setRoomCode(pveRoom.roomCode);
    setPlayers(pveRoom.players);
    setGame(pveRoom.game);
    setGameState('guessing');
    setScreen('game');
    setIsRoundOverModalOpen(false);
    if (roundNum === 1) {
      showToast(`Match started! Best of ${targetMaxRounds} rounds (${difficulty.toUpperCase()}). 🎮`);
    } else {
      showToast(`Round ${roundNum} of ${targetMaxRounds} — New word incoming! 🎯`);
    }
  };

  // ── 4. Submit Secret Word (Word Setter) ───────────────────────────────────
  const handleSubmitWord = (customWord) => {
    const word = (customWord || secretWordInput).trim().toUpperCase();
    if (!word) {
      setWordValidationMsg('Please enter a word.');
      return;
    }
    if (word.length < 2 || word.length > 20) {
      setWordValidationMsg('Word must be between 2 and 20 letters.');
      return;
    }
    if (!isValidWord(word)) {
      setWordValidationMsg(`"${word}" is not in the dictionary.`);
      return;
    }

    setWordValidationMsg('');
    setSetterWordSubmitted(true);

    const socket = getSocket();
    if (socket) {
      socket.emit('set_word', { word });
    }
  };

  // ── 5. Guess Letter (Guesser) ─────────────────────────────────────────────
  const handleGuessLetter = (letter) => {
    if (gameState !== 'guessing' || !game) return;
    const l = letter.toUpperCase();
    if (game.guessedLetters.includes(l)) return;

    if (isPveMode) {
      const currentRoom = { state: gameState, players, game };
      const nextRoom = processGuess(currentRoom, l);
      if (nextRoom.state === 'roundover') {
        const won = nextRoom.game.roundResult === 'guesser_wins';
        // Fix #1: Freeze the random dialogue exactly once when the round ends
        const mistakes = nextRoom.game.wrongGuesses?.length ?? 0;
        setFrozenDialogue(getRandomPerformanceDialogue(mistakes, won));

        if (won) {
          setPveScore(s => ({ ...s, human: s.human + 1 }));
        } else {
          setPveScore(s => ({ ...s, bot: s.bot + 1 }));
        }
      }
      applyState(nextRoom);
      return;
    }

    const socket = getSocket();
    if (socket) {
      socket.emit('guess_letter', { letter: l });
    }
  };

  // ── 6. Next Round & Skip Countdown ────────────────────────────────────────
  const handleNextRound = () => {
    if (isPveMode) {
      const nextRound = pveRound + 1;
      setPveRound(nextRound);
      startPveGame(pveDifficulty, nextRound, null, pveMaxRounds);
      return;
    }

    setIsWaitingOpponent(true);
    const socket = getSocket();
    if (socket) {
      socket.emit('next_round');
    }
  };

  // Instant Skip for the 4-second Countdown
  const handleSkipCountdown = () => {
    if (pveCountdownRef.current) {
      clearInterval(pveCountdownRef.current);
      pveCountdownRef.current = null;
    }
    setPveCountdown(null);
    const nextRound = pveRound + 1;
    setPveRound(nextRound);
    startPveGame(pveDifficulty, nextRound, pveScore, pveMaxRounds);
  };

  // ── PvE Auto-Continue Countdown (runs when modal opens in non-final rounds) ──
  const pveCountdownRef = useRef(null);
  useEffect(() => {
    // Only run when modal is open in PvE mode, not the final round
    if (!isRoundOverModalOpen || !isPveMode || pveRound >= pveMaxRounds) {
      if (pveCountdownRef.current) clearInterval(pveCountdownRef.current);
      setPveCountdown(null);
      return;
    }

    let count = 4;
    setPveCountdown(count);

    pveCountdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(pveCountdownRef.current);
        pveCountdownRef.current = null;
        setPveCountdown(null);
        setPveScore(latestScore => {
          const nextRound = pveRound + 1;
          setPveRound(nextRound);
          startPveGame(pveDifficulty, nextRound, latestScore, pveMaxRounds);
          return latestScore;
        });
      } else {
        setPveCountdown(count);
      }
    }, 1000);

    return () => {
      if (pveCountdownRef.current) {
        clearInterval(pveCountdownRef.current);
        pveCountdownRef.current = null;
      }
    };
  }, [isRoundOverModalOpen, isPveMode, pveRound, pveMaxRounds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 7. Leave Game ──────────────────────────────────────────────────────────
  const handleLeaveGame = () => {
    setScreen('lobby');
    setRoomCode('');
    setJoinCode('');
    setGame(null);
    setGameState('waiting');
    setIsRoundOverModalOpen(false);
    setSetterWordSubmitted(false);
    setLobbyError('');
    setP1Scored(false);
    setP2Scored(false);
    prevP1ScoreRef.current = null;
    prevP2ScoreRef.current = null;
  };

  // Refresh Suggestions Helper
  const refreshSuggestions = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('get_suggestions');
    } else {
      setSuggestions(getRandomSuggestions(12));
    }
    showToast('Refreshed word suggestions 💡', 1500);
  };

  // Copy Room Code Helper
  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      showToast('Room code copied to clipboard! 📋');
    }
  };

  // Derived Values
  const isWordSetter = game ? (game.wordSetterId === myPlayerId) : false;
  const livesLeft = game ? game.livesLeft : MAX_LIVES;
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const hiddenWordChars = (game?.hiddenWord || '').split(' ').filter(Boolean);

  // Scoreboard display
  const p1 = players[0] || { name: 'Player 1', score: 0 };
  const p2 = players[1] || { name: isPveMode ? 'Computer 🤖' : 'Player 2', score: 0 };

  // Detect Point Increments for P1 & P2 Score Celebration Animations
  useEffect(() => {
    const currentScore = p1.score;
    if (prevP1ScoreRef.current !== null && currentScore > prevP1ScoreRef.current) {
      setP1Scored(true);
      if (p1ScoreTimerRef.current) clearTimeout(p1ScoreTimerRef.current);
      p1ScoreTimerRef.current = setTimeout(() => {
        setP1Scored(false);
      }, 900);
    }
    prevP1ScoreRef.current = currentScore;
  }, [p1.score]);

  useEffect(() => {
    const currentScore = p2.score;
    if (prevP2ScoreRef.current !== null && currentScore > prevP2ScoreRef.current) {
      setP2Scored(true);
      if (p2ScoreTimerRef.current) clearTimeout(p2ScoreTimerRef.current);
      p2ScoreTimerRef.current = setTimeout(() => {
        setP2Scored(false);
      }, 900);
    }
    prevP2ScoreRef.current = currentScore;
  }, [p2.score]);

  // Clean up score celebration timers on unmount
  useEffect(() => {
    return () => {
      if (p1ScoreTimerRef.current) clearTimeout(p1ScoreTimerRef.current);
      if (p2ScoreTimerRef.current) clearTimeout(p2ScoreTimerRef.current);
    };
  }, []);

  // Timer ring stroke offset
  const timerFraction = Math.max(0, timerSecondsLeft / Math.max(1, timerTotal || 60));
  const RING_CIRCUMFERENCE = 263.9;
  const timerRingOffset = RING_CIRCUMFERENCE * (1 - timerFraction);

  // ── Determine POV theme for Roundover modal ────────────────────────────────
  // Fix #1: use frozenDialogue (set once on round-end) instead of calling
  // getRandomPerformanceDialogue() directly in render to stop flickering.
  let roundoverThemeClass = '';
  let roundoverIcon = '🎉';
  let roundoverTitle = '';
  let roundoverSubtitle = '';

  // ── PvE Match-over detection ───────────────────────────────────────────────
  const isPveMatchOver = isPveMode && pveRound >= pveMaxRounds && isRoundOverModalOpen;
  const pveMatchWinner = isPveMatchOver
    ? (p1.score > p2.score ? 'human' : p1.score < p2.score ? 'bot' : 'draw')
    : null;

  if (game?.roundResult === 'setter_wins') {
    if (isWordSetter) {
      roundoverThemeClass = 'victory-theme';
      roundoverIcon = '🏆';
      roundoverTitle = 'Execution Successful! 💀';
      roundoverSubtitle = `${game.setterName || 'Your'}'s word stumped ${game.guesserName || 'opponent'}!`;
    } else {
      roundoverThemeClass = 'defeat-theme';
      roundoverIcon = '☠️';
      roundoverTitle = 'You Were Hanged! ☠️';
      roundoverSubtitle = `${game.setterName || 'Opponent'}'s word stumped ${isPveMode ? 'you' : game.guesserName || 'you'}!`;
    }
  } else if (game?.roundResult === 'guesser_wins') {
    const mistakes = wrongGuesses.length;
    if (!isWordSetter) {
      roundoverThemeClass = 'guesser-victory-theme victory-theme';
      roundoverIcon = mistakes === 0 ? '👑' : (mistakes >= 7 ? '😅' : '🎉');
      // Fix #1: use frozenDialogue; fall back to live call only in multiplayer
      roundoverTitle = isPveMode ? (frozenDialogue || getRandomPerformanceDialogue(mistakes, true)) : getRandomPerformanceDialogue(mistakes, true);
      roundoverSubtitle = isPveMode
        ? "You figured out Computer's secret word!"
        : `${game.guesserName || 'Guesser'} figured out ${game.setterName || 'Setter'}'s word!`;
    } else {
      roundoverThemeClass = 'setter-defeat-theme defeat-theme';
      roundoverIcon = mistakes >= 7 ? '💔' : '🏃💨';
      roundoverTitle = isPveMode ? (frozenDialogue || getRandomPerformanceDialogue(mistakes, false)) : getRandomPerformanceDialogue(mistakes, false);
      roundoverSubtitle = `${game.guesserName || 'Guesser'} figured out your word!`;
    }
  }

  // Guessed set
  const guessedSet = new Set((game?.guessedLetters || []).map(l => l.toUpperCase()));
  const wrongSet = new Set((game?.wrongGuesses || []).map(l => l.toUpperCase()));
  const newGuessedSet = new Set(newlyGuessedLetters.map(l => l.toUpperCase()));
  const newWrongSet = new Set(newlyWrongLetters.map(l => l.toUpperCase()));
  const cleanWord = (game?.word || '').toUpperCase();

  return (
    <>
      {/* ─── LOBBY SCREEN ─────────────────────────────────────────────────── */}
      <div id="screen-lobby" className={`screen ${screen === 'lobby' ? 'active' : ''}`}>
        <div className="lobby-bg-anim">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="lobby-card glass">
          <div className="logo">
            <div className="logo-gallows" aria-hidden="true">
              <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="10" y1="115" x2="90" y2="115" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <line x1="30" y1="115" x2="30" y2="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <line x1="30" y1="10" x2="65" y2="10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <line x1="65" y1="10" x2="65" y2="25" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                <circle cx="65" cy="35" r="10" stroke="currentColor" strokeWidth="3" />
                <line x1="65" y1="45" x2="65" y2="75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <line x1="65" y1="55" x2="50" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <line x1="65" y1="55" x2="80" y2="65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <line x1="65" y1="75" x2="52" y2="92" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <line x1="65" y1="75" x2="78" y2="92" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <h1>Hangman <span className="accent">Duel</span></h1>
            <p className="tagline">Real-time 2-player word guessing</p>
          </div>

          <div className="lobby-form">
            <div className="input-group">
              <label htmlFor="input-name">Your Name</label>
              <input
                id="input-name"
                type="text"
                placeholder="Enter your name…"
                maxLength={20}
                autoComplete="off"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateRoom(); }}
              />
            </div>

            <div className="lobby-actions">
              <div className="create-section">
                <button
                  id="btn-create"
                  className={`btn btn-primary ${connectionStatus !== 'connected' || isConnecting ? 'loading' : ''}`}
                  aria-label="Create a new room"
                  disabled={connectionStatus !== 'connected' || isConnecting}
                  onClick={handleCreateRoom}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {connectionStatus === 'missing_env'
                    ? 'Backend URL Missing in Vercel'
                    : isConnecting
                    ? 'Creating Room… 🎮'
                    : connectionStatus === 'waking_up'
                    ? 'Waking up free server (may take 45s)… ⏳'
                    : connectionStatus === 'connecting'
                    ? 'Connecting to Server…'
                    : 'Create Room'}
                </button>

                {/* Host Settings */}
                <div className="host-settings-toggle">
                  <button
                    id="btn-advanced"
                    className="btn-advanced-toggle"
                    aria-expanded={advancedOpen}
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                    </svg>
                    Advanced Settings
                    <svg className="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                <div id="host-settings" className={`host-settings ${advancedOpen ? 'expanded' : 'collapsed'}`}>
                  <div className="host-settings-inner">
                    <div className="setting-row">
                      <label htmlFor="select-timer" className="setting-label">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        Word Pick Time Limit
                      </label>
                      <select
                        id="select-timer"
                        className="setting-select"
                        value={wordPickTime}
                        onChange={(e) => setWordPickTime(Number(e.target.value))}
                      >
                        <option value="30">30 seconds</option>
                        <option value="60">60 seconds</option>
                        <option value="90">90 seconds</option>
                        <option value="120">120 seconds</option>
                      </select>
                    </div>
                    <p className="setting-hint">If the Word Setter doesn't pick in time, a random word is chosen automatically.</p>
                  </div>
                </div>
              </div>

              <div className="divider"><span>or</span></div>

              <div className="join-row">
                <input
                  id="input-room-code"
                  type="text"
                  placeholder="Room Code"
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  autoComplete="off"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
                />
                <button id="btn-join" className="btn btn-secondary" onClick={handleJoinRoom}>
                  Join
                </button>
              </div>

              <div className="divider"><span>single player</span></div>

              <button
                id="btn-pve"
                className="btn btn-pve"
                type="button"
                onClick={() => setShowPveModal(true)}
              >
                <span className="pve-icon">🤖</span>
                <span className="pve-text">Play vs Computer</span>
                <span className="pve-badge">PvE Mode</span>
              </button>
            </div>

            <div id="lobby-error" className={`error-banner ${lobbyError ? '' : 'hidden'}`} role="alert">
              {lobbyError}
            </div>
          </div>
        </div>
      </div>

      {/* ─── WAITING SCREEN ───────────────────────────────────────────────── */}
      <div id="screen-waiting" className={`screen ${screen === 'waiting' ? 'active' : ''}`}>
        <div className="waiting-card glass flex flex-col items-center gap-4">
          <div className="pulse-ring mb-2" aria-label="Waiting status indicator"></div>
          <h2 className="text-xl font-bold tracking-wide">Waiting for opponent…</h2>
          <p>Share this code with your friend:</p>
          <div
            className="room-code-display"
            id="display-room-code"
            onClick={copyRoomCode}
            title="Click to copy"
          >
            {roomCode}
          </div>
          <button id="btn-copy-code" className="btn btn-ghost" onClick={copyRoomCode}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Code
          </button>
          <button id="btn-leave-waiting" className="btn btn-ghost btn-sm" onClick={handleLeaveGame}>
            Leave Room
          </button>
        </div>
      </div>

      {/* ─── ACTIVE GAME ARENA ────────────────────────────────────────────── */}
      <div
        id="screen-game"
        className={`screen ${screen === 'game' ? 'active' : ''} ${isScreenFlashing ? 'game-losing-flash' : ''}`}
      >
        {/* Header Bar */}
        <header className="game-header">
          <div className="header-brand">
            <span className="header-logo">🎯</span>
            <span className="header-title">Hangman <strong>Duel</strong></span>
          </div>

          {/* Header Scoreboard with Point Celebration Animations */}
          <div id="scoreboard" className="scoreboard" aria-live="polite">
            <div className={`score-player ${p1Scored ? 'score-box-pulse p1-pulse' : ''}`} id="score-p1">
              {p1Scored && <span className="score-plus-one">+1</span>}
              <span className="score-name" id="score-name-p1">{p1.name}</span>
              <span className={`score-val ${p1Scored ? 'score-num-pop' : ''}`} id="score-val-p1">{p1.score}</span>
            </div>
            <div className="score-divider">:</div>
            <div className={`score-player score-player-right ${p2Scored ? 'score-box-pulse p2-pulse' : ''}`} id="score-p2">
              {p2Scored && <span className="score-plus-one">+1</span>}
              <span className={`score-val ${p2Scored ? 'score-num-pop' : ''}`} id="score-val-p2">{p2.score}</span>
              <span className="score-name" id="score-name-p2">{p2.name}</span>
            </div>
          </div>

          <div className="header-room">
            <span id="header-room-code">
              {isPveMode ? `BOT: ${pveDifficulty.toUpperCase()}` : `ROOM: ${roomCode}`}
            </span>
            <button id="btn-leave-game" className="btn btn-ghost btn-sm" onClick={handleLeaveGame}>
              Leave
            </button>
          </div>
        </header>

        <main className="game-main">
          {/* Role Banner */}
          <div id="role-banner" className="role-banner" aria-live="polite">
            {gameState === 'setting'
              ? (isWordSetter ? '👑 You are the Word Setter — Choose a secret word' : '⏳ Opponent is choosing a secret word…')
              : (isWordSetter ? '👁 Watching — You set the word' : '🤔 Guess the secret word!')}
          </div>

          {/* ─── WORD SETTER PANEL (Keyboard is hidden) ───────────────────── */}
          {gameState === 'setting' && isWordSetter && (
            <section id="panel-word-setter" className="panel">
              <div className="panel-card glass setter-panel-card">
                {/* Circular countdown timer ring */}
                <div className="setter-timer-ring" id="setter-timer-ring" aria-label="Time remaining">
                  <svg className="timer-svg" viewBox="0 0 100 100">
                    <circle className="timer-track" cx="50" cy="50" r="42" />
                    <circle
                      className={`timer-fill ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}
                      id="timer-ring-fill"
                      cx="50"
                      cy="50"
                      r="42"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      strokeDashoffset={timerRingOffset}
                    />
                  </svg>
                  <div className="timer-inner">
                    <span id="setter-timer-val" className={`timer-val ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}>
                      {timerSecondsLeft}
                    </span>
                    <span className="timer-unit">sec</span>
                  </div>
                </div>

                <h2 className="panel-title">Choose a Secret Word</h2>
                <p className="panel-sub">Your opponent will try to guess it. No hints allowed!</p>

                <div className="word-input-group">
                  <input
                    id="input-word"
                    type="text"
                    placeholder="Enter a word…"
                    maxLength={30}
                    autoComplete="off"
                    value={secretWordInput}
                    onChange={(e) => {
                      setSecretWordInput(e.target.value.toUpperCase());
                      setWordValidationMsg('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmitWord();
                    }}
                    spellCheck="false"
                  />
                  <button
                    id="btn-submit-word"
                    className="btn btn-primary"
                    onClick={() => handleSubmitWord()}
                  >
                    Submit Word
                  </button>
                </div>

                {wordValidationMsg && (
                  <div id="word-validation-msg" className="validation-msg error">
                    {wordValidationMsg}
                  </div>
                )}

                {/* Always-visible Word Suggestions Panel for Setter */}
                <div className="word-suggestions-panel" id="word-suggestions-panel">
                  <div className="suggestions-header">
                    <div className="suggestions-title-group">
                      <span className="suggestions-badge">⚡ Instant Pick</span>
                      <span className="suggestions-title">Word Suggestions</span>
                    </div>
                    <button
                      id="btn-refresh-suggestions"
                      className="btn-refresh-suggestions"
                      type="button"
                      onClick={refreshSuggestions}
                      title="Get new suggestions"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="refresh-icon">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      <span>New Words</span>
                    </button>
                  </div>
                  <p className="suggestions-sub">Click any word below to instantly select it, or type your own word above.</p>

                  <div id="word-suggestions-grid" className="word-suggestions-grid">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="suggestion-card"
                        onClick={() => {
                          const w = item.word.toUpperCase();
                          setSecretWordInput(w);
                          handleSubmitWord(w);
                        }}
                      >
                        <span className="suggestion-word">{item.word}</span>
                        <span className="suggestion-meaning">{item.meaning}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {setterWordSubmitted && (
                <div className="setter-waiting" id="setter-waiting-msg">
                  <div className="mini-pulse"></div>
                  <p>Word accepted! Waiting for the guesser…</p>
                </div>
              )}
            </section>
          )}

          {/* ─── GUESSER WAITING PANEL (Setting Phase) ────────────────────── */}
          {gameState === 'setting' && !isWordSetter && (
            <section id="panel-guesser-waiting" className="panel">
              <div className="guesser-waiting-layout">
                <canvas id="particle-canvas" ref={particleCanvasRef} className="particle-canvas" />

                <div className="guesser-waiting-content glass">
                  <div className="gw-icon">⏳</div>
                  <h2 className="gw-title">Opponent is choosing a word</h2>
                  <p id="scramble-text" className="gw-scramble">{scrambleText}</p>

                  {/* Synced Timer */}
                  <div className="gw-timer-bar">
                    <div className="gw-timer-label">Time remaining</div>
                    <div className="gw-timer-track">
                      <div
                        className={`gw-timer-fill ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}
                        id="gw-timer-fill"
                        style={{ width: `${(timerSecondsLeft / (timerTotal || 60)) * 100}%` }}
                      ></div>
                    </div>
                    <div id="gw-timer-val" className={`gw-timer-val ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}>
                      {timerSecondsLeft}s
                    </div>
                  </div>

                  {/* Unselectable Rotating Did You Know? Facts Widget */}
                  <div className="facts-widget" id="facts-widget-guesser" style={{ userSelect: 'none' }}>
                    <div className="facts-header">
                      <span className="facts-icon">💡</span>
                      <span className="facts-title">Did You Know?</span>
                      <span className="facts-badge">Trivia</span>
                    </div>
                    <div className="fact-card">
                      <p id="random-fact-text" className={`fact-text ${guesserFactFade ? 'fact-fade-out' : ''}`}>
                        {currentGuesserFact}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── GUESSER ACTIVE PANEL ─────────────────────────────────────── */}
          {(gameState === 'guessing' || gameState === 'roundover') && !isWordSetter && (
            <section id="panel-guesser" className="panel">
              <div className="game-layout">
                {/* Left Column: Canvas & Lives */}
                <div className="hangman-area">
                  <div className={`canvas-wrapper ${isGallowsSwinging ? 'hangman-swing' : ''}`} id="canvas-wrapper">
                    <canvas id="hangman-canvas" ref={hangmanCanvasRef} width={200} height={240} />
                  </div>
                  <div className="lives-display">
                    <span id="lives-left" className={`lives-number ${livesLeft <= 3 ? 'danger' : livesLeft <= 6 ? 'warn' : ''}`}>
                      {livesLeft}
                    </span>
                    <span className="lives-label">lives left</span>
                  </div>
                  <div id="wrong-letters" className="wrong-letters">
                    {wrongGuesses.map((l, i) => (
                      <span key={i} className={`wrong-letter-chip ${newWrongSet.has(l.toUpperCase()) ? 'new-wrong' : ''}`}>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Column: Word Slots & Interactive Keyboard */}
                <div className="guess-area">
                  <div id="word-display" className="word-display">
                    {hiddenWordChars.map((slot, i) => {
                      const isRevealed = slot !== '_';
                      const isNew = isRevealed && newGuessedSet.has(slot.toUpperCase());

                      return (
                        <div key={i} className="letter-box">
                          <span className={`letter-char ${!isRevealed ? 'blank' : isNew ? 'letter-drop-in' : ''}`}>
                            {slot === '_' ? '_' : slot}
                          </span>
                          <div className={`letter-line ${isRevealed ? 'revealed' : ''}`}></div>
                        </div>
                      );
                    })}
                  </div>

                  {/* QWERTY Keyboard — 3 explicit rows, centered */}
                  <div id="keyboard" className="keyboard">
                    {KEYBOARD_ROWS.map((row, rIdx) => (
                      <div key={rIdx} className="keyboard-row">
                        {row.map((letter) => {
                          const isGuessed = guessedSet.has(letter);
                          const isWrong = wrongSet.has(letter);
                          const isCorrect = isGuessed && !isWrong;

                          let stateClass = '';
                          if (isCorrect) stateClass = 'correct';
                          if (isWrong) stateClass = 'wrong';

                          return (
                            <button
                              key={letter}
                              type="button"
                              className={`key-btn ${stateClass}`}
                              disabled={isGuessed || gameState === 'roundover'}
                              onClick={() => handleGuessLetter(letter)}
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
            </section>
          )}

          {/* ─── SETTER WATCHING PANEL ────────────────────────────────────── */}
          {(gameState === 'guessing' || gameState === 'roundover') && isWordSetter && (
            <section id="panel-watching" className="panel">
              <div className="game-layout game-layout-watch">
                {/* Left Column: Canvas & Opponent Lives */}
                <div className="hangman-area">
                  <div className={`canvas-wrapper ${isGallowsSwinging ? 'hangman-swing' : ''}`} id="canvas-wrapper-watch">
                    <canvas id="hangman-canvas-watch" ref={hangmanWatchCanvasRef} width={200} height={240} />
                  </div>
                  <div className="lives-display">
                    <span id="lives-left-watch" className={`lives-number ${livesLeft <= 3 ? 'danger' : livesLeft <= 6 ? 'warn' : ''}`}>
                      {livesLeft}
                    </span>
                    <span className="lives-label">lives left</span>
                  </div>
                  <div id="wrong-letters-watch" className="wrong-letters">
                    {wrongGuesses.map((l, i) => (
                      <span key={i} className={`wrong-letter-chip ${newWrongSet.has(l.toUpperCase()) ? 'new-wrong' : ''}`}>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Column: Live Word Progression & Watcher Trivia */}
                <div className="guess-area">
                  <div className="watch-badge">
                    <span>👁</span> Watching — You set the word
                  </div>

                  <div id="word-display-watch" className="word-display">
                    {hiddenWordChars.map((slot, i) => {
                      const isRevealed = slot !== '_';
                      const isNew = isRevealed && newGuessedSet.has(slot.toUpperCase());

                      return (
                        <div key={i} className="letter-box">
                          <span className={`letter-char ${!isRevealed ? 'blank' : isNew ? 'letter-drop-in' : ''}`}>
                            {slot === '_' ? '_' : slot}
                          </span>
                          <div className={`letter-line ${isRevealed ? 'revealed' : ''}`}></div>
                        </div>
                      );
                    })}
                  </div>

                  <div id="your-word-reveal" className="your-word-reveal">
                    SECRET WORD: <strong>{game?.word}</strong>
                  </div>

                  {/* Trivia Widget */}
                  <div id="facts-widget-watching" className="facts-widget facts-widget-watch" style={{ userSelect: 'none' }}>
                    <div className="facts-header">
                      <span className="facts-icon">💡</span>
                      <span className="facts-title">Did You Know?</span>
                    </div>
                    <div className="fact-card">
                      <p id="random-fact-watch" className={`fact-text ${watchFactFade ? 'fact-fade-out' : ''}`}>
                        {currentWatchFact}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── ROUND OVER OVERLAY MODAL ─────────────────────────────────── */}
          {isRoundOverModalOpen && (
            <div id="overlay-roundover" className={`overlay-roundover ${isPveMatchOver ? (pveMatchWinner === 'human' ? 'guesser-victory-theme victory-theme' : pveMatchWinner === 'draw' ? '' : 'defeat-theme') : roundoverThemeClass}`}>
              <div className="roundover-card glass">

                {/* ── PvE MATCH OVER SCREEN ───────────────────────────── */}
                {isPveMatchOver ? (
                  <>
                    <div id="roundover-icon" className="roundover-icon">
                      {pveMatchWinner === 'human' ? '🏆' : pveMatchWinner === 'draw' ? '🤝' : '💀'}
                    </div>
                    <h2 id="roundover-title" className="roundover-title" style={{ fontSize: '1.6rem' }}>
                      {pveMatchWinner === 'human'
                        ? '🏆 You beat the Computer!'
                        : pveMatchWinner === 'draw'
                        ? '🤝 It\'s a Draw!'
                        : '💀 The Computer outsmarted you!'}
                    </h2>
                    <p id="roundover-subtitle" className="roundover-subtitle">
                      {pveMatchWinner === 'human'
                        ? `Final score: ${p1.score} – ${p2.score}. Impressive!`
                        : pveMatchWinner === 'draw'
                        ? `Both ended at ${p1.score} – ${p2.score}. Evenly matched!`
                        : `Final score: ${p1.score} – ${p2.score}. Better luck next time!`}
                    </p>

                    <div id="roundover-scores" className="roundover-scores" style={{ marginBottom: '1.5rem' }}>
                      <div className="rs-player">
                        <span className="rs-name">{p1.name}</span>
                        <span className="rs-score" style={{ fontSize: '2rem' }}>{p1.score}</span>
                      </div>
                      <div className="rs-divider">–</div>
                      <div className="rs-player">
                        <span className="rs-name">{p2.name}</span>
                        <span className="rs-score" style={{ fontSize: '2rem' }}>{p2.score}</span>
                      </div>
                    </div>

                    <button
                      id="btn-new-match"
                      className="btn btn-primary btn-lg"
                      onClick={() => startPveGame(pveDifficulty, 1, { human: 0, bot: 0 }, pveMaxRounds)}
                    >
                      🔄 Start New Match
                    </button>
                  </>
                ) : (
                  /* ── STANDARD ROUND OVER SCREEN ──────────────────────── */
                  <>
                    <div id="roundover-icon" className="roundover-icon">{roundoverIcon}</div>
                    <h2 id="roundover-title" className="roundover-title">{roundoverTitle}</h2>
                    <p id="roundover-subtitle" className="roundover-subtitle">{roundoverSubtitle}</p>

                    {/* Round Progress Indicator (PvE only) */}
                    {isPveMode && (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '0.5rem 0 0.25rem', alignItems: 'center' }}>
                        {Array.from({ length: pveMaxRounds }).map((_, i) => (
                          <span
                            key={i}
                            style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: i < pveRound ? 'var(--accent, #a78bfa)' : 'rgba(255,255,255,0.2)',
                              display: 'inline-block',
                              border: i === pveRound - 1 ? '2px solid #fff' : '2px solid transparent',
                              transition: 'background 0.3s'
                            }}
                          />
                        ))}
                        <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: 6 }}>Round {pveRound} / {pveMaxRounds}</span>
                      </div>
                    )}

                    <div className="roundover-word" id="roundover-word">
                      {cleanWord.split('').map((ch, idx) => {
                        let letterClass = 'word-letter-span ';
                        const guesserWon = game?.roundResult === 'guesser_wins';
                        if (guesserWon) {
                          letterClass += !isWordSetter ? 'word-letter-unlocked' : 'word-letter-exposed';
                        } else {
                          letterClass += guessedSet.has(ch) ? 'word-letter-guessed' : 'word-letter-missed';
                        }
                        return (
                          <span key={idx} className={letterClass} style={{ '--index': idx }}>{ch}</span>
                        );
                      })}
                    </div>

                    <div id="roundover-scores" className="roundover-scores">
                      <div className="rs-player">
                        <span className="rs-name">{p1.name}</span>
                        <span className="rs-score">{p1.score}</span>
                      </div>
                      <div className="rs-divider">:</div>
                      <div className="rs-player">
                        <span className="rs-name">{p2.name}</span>
                        <span className="rs-score">{p2.score}</span>
                      </div>
                    </div>

                    {/* PvE: auto-countdown + Instant Skip Button */}
                    {isPveMode ? (
                      <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
                        <p style={{ fontSize: '0.95rem', opacity: 0.85, margin: 0 }}>
                          {pveCountdown !== null
                            ? `Next round starting in ${pveCountdown}…`
                            : 'Starting next round…'}
                        </p>
                        <div style={{
                          width: '100%', height: 4, borderRadius: 4,
                          background: 'rgba(255,255,255,0.12)', overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 4,
                            background: 'var(--accent, #a78bfa)',
                            width: `${((4 - (pveCountdown ?? 0)) / 4) * 100}%`,
                            transition: 'width 0.9s linear'
                          }} />
                        </div>
                        <button
                          id="btn-skip-countdown"
                          className="btn btn-secondary btn-sm"
                          type="button"
                          onClick={handleSkipCountdown}
                          style={{
                            marginTop: '0.25rem',
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.9rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <span>Start Instantly</span>
                          <span>⏩</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        id="btn-next-round"
                        className="btn btn-primary btn-lg"
                        disabled={isWaitingOpponent}
                        onClick={handleNextRound}
                      >
                        {isWaitingOpponent ? 'Waiting for opponent…' : 'Next Round ↩ Swap Roles'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─── PVE DIFFICULTY & MATCH LENGTH SELECTION MODAL ────────────────── */}
      {showPveModal && (
        <div id="modal-difficulty" className="modal-backdrop">
          <div className="modal-card glass difficulty-card">
            <div className="modal-header">
              <div className="difficulty-icon-wrap">🤖</div>
              <h2 id="difficulty-title">Play vs Computer</h2>
              <p className="modal-sub">Configure your match settings and letter difficulty.</p>
            </div>

            {/* Match Length Selector */}
            <div className="match-length-section" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Match Length
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {[3, 5, 10].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    className={`btn btn-sm ${pveMaxRounds === rounds ? 'btn-primary' : 'btn-ghost'}`}
                    style={{
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      border: pveMaxRounds === rounds ? '1px solid var(--accent, #a78bfa)' : '1px solid rgba(255,255,255,0.1)'
                    }}
                    onClick={() => setPveMaxRounds(rounds)}
                  >
                    {rounds} Rounds
                  </button>
                ))}
              </div>
            </div>

            {/* Authentic Difficulty Options */}
            <div className="difficulty-options">
              <button
                className="diff-btn diff-easy"
                type="button"
                onClick={() => startPveGame('easy', 1, null, pveMaxRounds)}
              >
                <div className="diff-header">
                  <span className="diff-tag">Easy</span>
                  <span className="diff-length">Common Letters</span>
                </div>
                <p className="diff-desc">Rich in standard vowels (A, E, I, O) and frequent letters (E, T, A, O, I, N, S, H, R).</p>
              </button>

              <button
                className="diff-btn diff-medium"
                type="button"
                onClick={() => startPveGame('medium', 1, null, pveMaxRounds)}
              >
                <div className="diff-header">
                  <span className="diff-tag">Medium</span>
                  <span className="diff-length">Standard Mix</span>
                </div>
                <p className="diff-desc">Everyday vocabulary with a balanced mix of common and intermediate consonants.</p>
              </button>

              <button
                className="diff-btn diff-hard"
                type="button"
                onClick={() => startPveGame('hard', 1, null, pveMaxRounds)}
              >
                <div className="diff-header">
                  <span className="diff-tag">Hard</span>
                  <span className="diff-length">Rare & Vowelless</span>
                </div>
                <p className="diff-desc">High-penalty letters (Z, Q, X, J, K, V, W) or tricky vowel-sparse words (e.g. RHYTHM, JINX, AWKWARD).</p>
              </button>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                id="btn-cancel-pve"
                className="btn btn-ghost"
                type="button"
                onClick={() => setShowPveModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div key={toastKey} id="toast" className={`toast ${toastMsg ? '' : 'hidden'}`} role="status">
        {toastMsg}
      </div>
    </>
  );
}
