'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Navbar from '../components/Navbar.jsx';
import InteractiveHeroCard from '../components/InteractiveHeroCard.jsx';
import CustomDropdown from '../components/CustomDropdown.jsx';
import WaitingRoomUI from '../components/WaitingRoomUI.jsx';
import {
  playMechanicalClick,
  speakDialogue,
  stopDialogue,
  isVoiceMuted,
  setVoiceMuted,
  isSfxMuted,
  setSfxMuted
} from '../lib/audio.js';
import { getSocket, getSessionId, isBackendConfigured, getBackendUrl } from '../lib/socket.js';
import { ServerlessSocket } from '../lib/serverlessSocket.js';
import { Lightbulb, Loader2, Crown, Users, Shield } from 'lucide-react';
import { getRandomWord, isValidWord, getRandomSuggestions, getWordMeaning, validateAndFetchClue } from '../lib/dictionary.js';
import { TEAM_NAMES } from '../utils/teamNames.js';
import {
  INITIAL_IDLE_PHRASES,
  MEAN_WRONG_PHRASES,
  DANGER_PHRASES,
  HAPPY_GUESS_PHRASES,
  ESCAPE_PHRASES,
  DEATH_PHRASES,
  getRandomPhrase
} from '../lib/stickmanDialogues.js';
import { getRandomFact } from '../lib/facts.js';
import { useRandomFacts } from '../hooks/useRandomFacts.js';
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
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [activeMode, setActiveMode] = useState('1v1'); // '1v1' | 'team' | 'pve'
  const [lobbyError, setLobbyError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
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

  // Stickman Mood & Dynamic Dialogue State
  const [stickmanMood, setStickmanMood] = useState('neutral'); // 'neutral' | 'happy' | 'panic'
  const [currentDialogue, setCurrentDialogue] = useState('');
  const socketRef = useRef(null);
  const dialogueTimeoutRef = useRef(null);
  const stickmanMoodRef = useRef('neutral');
  const currentDialogueRef = useRef('');

  // Voice (TTS) & Mechanical Click Sound States
  const [voiceMuted, setVoiceMutedState] = useState(false);
  const [sfxMuted, setSfxMutedState] = useState(false);

  useEffect(() => {
    setVoiceMutedState(isVoiceMuted());
    setSfxMutedState(isSfxMuted());
  }, []);

  // Multiplayer Game State
  const [myPlayerId, setMyPlayerId] = useState(() => {
    if (typeof window !== 'undefined') {
      return getSessionId() || '';
    }
    return '';
  });
  const [disconnectNotice, setDisconnectNotice] = useState(null); // { name: string, secondsLeft: number }
  const [gameState, setGameState] = useState('waiting'); // waiting | setting | guessing | roundover
  const [roomStatus, setRoomStatus] = useState('waiting'); // 'waiting' | 'playing'
  const [players, setPlayers] = useState([]);
  const [teamA, setTeamA] = useState([]);
  const [teamB, setTeamB] = useState([]);
  const [teamScores, setTeamScores] = useState({ teamA: 0, teamB: 0 });
  const [currentTurnTeam, setCurrentTurnTeam] = useState('teamB');
  const [wordSettingTeam, setWordSettingTeam] = useState('teamA');
  const [myTeam, setMyTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('teamB');
  const [game, setGame] = useState(null);
  const isWordSetter = isPveMode
    ? false
    : myTeam
    ? myTeam === wordSettingTeam
    : game
    ? game.wordSetterId === myPlayerId
    : false;
  const isMyTeamTurn = isPveMode
    ? true
    : myTeam
    ? myTeam === currentTurnTeam
    : true;
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(60);
  const [timerTotal, setTimerTotal] = useState(60);
  const [setterWordSubmitted, setSetterWordSubmitted] = useState(false);

  // ── Team Leader & Custom Team Names State ─────────────────────────────────
  const [teamNameA, setTeamNameA] = useState('Team A');
  const [teamNameB, setTeamNameB] = useState('Team B');
  const [leaderA, setLeaderA] = useState(null);
  const [leaderB, setLeaderB] = useState(null);
  const [suggestedNames, setSuggestedNames] = useState([]);
  const [customTeamNameInput, setCustomTeamNameInput] = useState('');

  const currentSocketId = socketRef.current?.id || getSocket()?.id;
  const isLeaderA = !!(currentSocketId && leaderA && currentSocketId === leaderA);
  const isLeaderB = !!(currentSocketId && leaderB && currentSocketId === leaderB);
  // Gatekeeper: only true if socket.id === room.leaderA or room.leaderB
  const isTeamLeader = isLeaderA || isLeaderB;
  const myLeaderTeam = isLeaderA ? 'teamA' : isLeaderB ? 'teamB' : (myTeam || 'teamA');

  const isHost = players.some(
    (p) => (p.sessionId === myPlayerId || p.socketId === currentSocketId || p.isYou) && p.isHost
  );

  const shuffleSuggestedNames = useCallback(() => {
    const shuffled = [...TEAM_NAMES].sort(() => Math.random() - 0.5);
    setSuggestedNames(shuffled.slice(0, 4));
  }, []);

  useEffect(() => {
    if (isTeamLeader) {
      shuffleSuggestedNames();
    }
  }, [isTeamLeader, shuffleSuggestedNames]);

  const handleAssignLeader = (targetSocketId, teamKey) => {
    playMechanicalClick();
    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('assign_leader', { socketId: targetSocketId, team: teamKey });
      showToast('Assigned new team leader! 👑');
    }
  };

  const handleConfirmTeamName = () => {
    playMechanicalClick();
    const trimmed = customTeamNameInput.trim();
    if (!trimmed) return;
    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('set_team_name', { team: myLeaderTeam, name: trimmed });
      setCustomTeamNameInput('');
      showToast(`Team name set to "${trimmed}"! 🛡️`);
    }
  };

  const handleToggleReady = () => {
    playMechanicalClick();
    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('toggle_ready');
    }
  };

  const handleSetTeamName = (teamKey, name) => {
    playMechanicalClick();
    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('set_team_name', { team: teamKey, name });
      showToast(`Team name updated to "${name}"! 🛡️`);
    }
  };

  // ── Reconnection Grace Period Countdown ────────────────────────────────────
  useEffect(() => {
    if (!disconnectNotice) return;
    const interval = setInterval(() => {
      setDisconnectNotice((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          clearInterval(interval);
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [disconnectNotice]);

  // Word Setter State
  const [secretWordInput, setSecretWordInput] = useState('');
  const [wordValidationMsg, setWordValidationMsg] = useState('');
  const setError = (msg) => setWordValidationMsg(msg || '');
  const [suggestions, setSuggestions] = useState([]);
  const [liveWordDef, setLiveWordDef] = useState(null);
  const [isLookingUpDef, setIsLookingUpDef] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Facts & Scramble State
  const isWaitingScreenActive = screen === 'waiting';
  const isGuesserWaitingActive = gameState === 'setting' && !isWordSetter;
  const isWatcherActive = (gameState === 'guessing' || gameState === 'roundover') && isWordSetter;
  const isFactsStreamActive = isWaitingScreenActive || isGuesserWaitingActive || isWatcherActive;

  const {
    fact: liveTriviaFact,
    isFading: isFactFading,
    fetchNextFact,
  } = useRandomFacts(isFactsStreamActive, 8000);

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
  const isRoundOverModalOpenRef = useRef(false);
  const roundOverHandledRef = useRef(false);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState(false);

  useEffect(() => {
    isRoundOverModalOpenRef.current = isRoundOverModalOpen;
  }, [isRoundOverModalOpen]);

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

  // In-Game Word Hint Clue State
  const [showHint, setShowHint] = useState(true);

  // Split Showcase Mock Keyboard State
  const [showcaseGuessed, setShowcaseGuessed] = useState({
    P: 'correct',
    X: 'correct',
    L: 'correct',
    E: 'wrong',
    O: 'wrong',
    T: 'wrong',
  });
  const [showcaseRevealed, setShowcaseRevealed] = useState(['P', '_', 'X', '_', 'L']);

  const handleShowcaseKeyClick = (letter) => {
    if (showcaseGuessed[letter]) return;
    const target = ['P', 'I', 'X', 'E', 'L'];
    if (target.includes(letter)) {
      setShowcaseGuessed((prev) => ({ ...prev, [letter]: 'correct' }));
      setShowcaseRevealed((prev) =>
        prev.map((c, idx) => (target[idx] === letter ? letter : c))
      );
    } else {
      setShowcaseGuessed((prev) => ({ ...prev, [letter]: 'wrong' }));
    }
  };
  const canvasAnimStateRef = useRef({ drawnSteps: 0, animId: null });
  const watchCanvasAnimStateRef = useRef({ drawnSteps: 0, animId: null });
  const specialAnimIdRef = useRef(null);

  // ── Real-Time Live Stats Tracking ──────────────────────────────────────────
  const [liveStats, setLiveStats] = useState({
    duelsPlayed: 0,
    wordsGuessed: 0,
    totalGuesses: 0,
    correctGuesses: 0,
    winRate: 0,
    activePlayers: 1,
  });

  // Load persisted stats on mount & sync with server /api/stats
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('hangman_duel_live_stats');
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        if (parsed && typeof parsed === 'object') {
          setLiveStats(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch {}

    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data?.stats) {
          setLiveStats(prev => {
            const merged = {
              duelsPlayed: Math.max(prev.duelsPlayed || 0, data.stats.duelsPlayed || 0),
              wordsGuessed: Math.max(prev.wordsGuessed || 0, data.stats.wordsGuessed || 0),
              totalGuesses: Math.max(prev.totalGuesses || 0, data.stats.totalGuesses || 0),
              correctGuesses: Math.max(prev.correctGuesses || 0, data.stats.correctGuesses || 0),
              activePlayers: Math.max(1, data.stats.activePlayers || 1),
              winRate: typeof data.stats.winRate === 'number' ? data.stats.winRate : (prev.winRate ?? 0),
            };
            try { localStorage.setItem('hangman_duel_live_stats', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  const recordGuessStats = useCallback((isCorrect) => {
    setLiveStats(prev => {
      const totalG = (prev.totalGuesses || 0) + 1;
      const correctG = (prev.correctGuesses || 0) + (isCorrect ? 1 : 0);
      const winRate = totalG > 0 ? Math.round((correctG / totalG) * 100) : 0;
      const next = { ...prev, totalGuesses: totalG, correctGuesses: correctG, winRate };
      try { localStorage.setItem('hangman_duel_live_stats', JSON.stringify(next)); } catch {}
      return next;
    });
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'record_guess', isCorrect }),
    }).catch(() => {});
  }, []);

  const recordDuelEndStats = useCallback((isGuesserWin) => {
    setLiveStats(prev => {
      const duels = (prev.duelsPlayed || 0) + 1;
      const words = (prev.wordsGuessed || 0) + (isGuesserWin ? 1 : 0);
      const next = { ...prev, duelsPlayed: duels, wordsGuessed: words };
      try { localStorage.setItem('hangman_duel_live_stats', JSON.stringify(next)); } catch {}
      return next;
    });
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isGuesserWin ? 'record_win' : 'record_duel' }),
    }).catch(() => {});
  }, []);

  // Auxiliary Refs
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

  // ── SSR-Safe Persistent Username (localStorage) ───────────────────────────
  useEffect(() => {
    try {
      const savedName = localStorage.getItem('hangman_username');
      if (savedName && savedName.trim()) {
        setPlayerName(savedName.trim());
      } else {
        setPlayerName('Player 1');
      }
    } catch {
      setPlayerName('Player 1');
    }
  }, []);

  // ── Auto-Parse ?join=CODE or ?room=CODE invite links ──────────────────────
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const codeParam = urlParams.get('join') || urlParams.get('room') || window.location.hash.replace('#room=', '').replace('#', '');
        if (codeParam && codeParam.trim()) {
          const cleanCode = codeParam.trim().toUpperCase().slice(0, 6);
          setJoinCode(cleanCode);
          showToast(`🎮 Room invite code "${cleanCode}" loaded! Enter your name to join.`, 4000);
          setTimeout(() => {
            const inputEl = document.getElementById('input-name');
            if (inputEl) {
              try {
                inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (window.innerWidth >= 768) {
                  inputEl.focus();
                }
              } catch {}
            }
          }, 400);
        }
      }
    } catch (e) {
      console.warn('Invite link parsing error:', e);
    }
  }, [showToast]);

  const handlePlayerNameChange = (val) => {
    setPlayerName(val);
    if (lobbyError) setLobbyError('');
    try {
      localStorage.setItem('hangman_username', val);
    } catch (err) {
      console.warn('Could not save username to localStorage:', err);
    }
  };

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

  // ── Canvas Glow & Speech Bubble Helpers ────────────────────────────────────

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

  // Helper to draw a dynamically measured, word-wrapped & clamped cartoon speech bubble on canvas
  const drawSpeechBubble = (
    ctx,
    targetHeadX,
    targetHeadY,
    text,
    side = 'left',
    borderColor = 'rgba(168, 85, 247, 0.85)',
    bgColor = 'rgba(15, 23, 42, 0.95)',
    textColor = '#f8fafc'
  ) => {
    if (!text) return;
    ctx.save();
    const fontSize = 10;
    const lineHeight = 13;
    ctx.font = `bold ${fontSize}px Outfit, Inter, system-ui, sans-serif`;

    const canvasW = ctx.canvas ? ctx.canvas.width : 220;
    const canvasH = ctx.canvas ? ctx.canvas.height : 240;
    const maxTextWidth = 125;

    // Word Wrap Algorithm into 1, 2, or max 3 lines
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxTextWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Calculate dynamic bubble dimensions based on wrapped lines
    let maxLineWidth = 0;
    lines.forEach(l => {
      const w = ctx.measureText(l).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });

    const bubbleWidth = Math.min(Math.ceil(maxLineWidth + 16), canvasW - 12);
    const bubbleHeight = Math.max(22, lines.length * lineHeight + 8);
    const radius = 6;

    let targetX;
    let targetY = targetHeadY - (bubbleHeight + 6);
    let pointerX, pointerY;

    if (side === 'left') {
      // Draw to the left of the head (between pole and stickman)
      targetX = targetHeadX - bubbleWidth - 10;
      pointerX = targetHeadX - 4;
      pointerY = targetHeadY - 6;
    } else if (side === 'right') {
      targetX = targetHeadX + 10;
      pointerX = targetHeadX + 4;
      pointerY = targetHeadY - 6;
    } else { // top/center
      targetX = targetHeadX - bubbleWidth / 2;
      targetY = targetHeadY - (bubbleHeight + 12);
      pointerX = targetHeadX;
      pointerY = targetHeadY - 6;
    }

    // Clamping: Ensure bubble stays strictly inside canvas bounds
    const safeX = Math.max(4, Math.min(targetX, canvasW - bubbleWidth - 4));
    const safeY = Math.max(4, Math.min(targetY, canvasH - bubbleHeight - 4));

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = borderColor;
    ctx.fillStyle = bgColor;

    ctx.beginPath();
    ctx.moveTo(safeX + radius, safeY);
    ctx.lineTo(safeX + bubbleWidth - radius, safeY);
    ctx.quadraticCurveTo(safeX + bubbleWidth, safeY, safeX + bubbleWidth, safeY + radius);
    ctx.lineTo(safeX + bubbleWidth, safeY + bubbleHeight - radius);
    ctx.quadraticCurveTo(safeX + bubbleWidth, safeY + bubbleHeight, safeX + bubbleWidth - radius, safeY + bubbleHeight);

    // Pointer tail to head
    const tailBaseX = Math.max(safeX + 6, Math.min(safeX + bubbleWidth - 18, pointerX - 8));
    ctx.lineTo(tailBaseX + 12, safeY + bubbleHeight);
    ctx.lineTo(pointerX, pointerY);
    ctx.lineTo(tailBaseX, safeY + bubbleHeight);

    ctx.lineTo(safeX + radius, safeY + bubbleHeight);
    ctx.quadraticCurveTo(safeX, safeY + bubbleHeight, safeX, safeY + bubbleHeight - radius);
    ctx.lineTo(safeX, safeY + radius);
    ctx.quadraticCurveTo(safeX, safeY, safeX + radius, safeY);
    ctx.closePath();

    applyGlow(ctx, borderColor, 6);
    ctx.fill();
    ctx.stroke();
    clearGlow(ctx);

    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Render each wrapped line centered inside the bubble
    lines.forEach((line, idx) => {
      const lineY = safeY + 4 + (idx + 0.5) * lineHeight;
      ctx.fillText(line, safeX + bubbleWidth / 2, lineY);
    });

    ctx.restore();
  };

  // ── Unified Dynamic Canvas Animation Engine ──────────────────────────────
  const drawFrame = useCallback((canvas, mistakes, isDead, timeMs = 0) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 330;
    const h = 360;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    const scale = w / 220; // 1.5x scale for high-DPI crisp rendering
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const t = timeMs * 0.001; // in seconds
    const mood = stickmanMoodRef.current;
    const dialogue = currentDialogueRef.current;

    // 1. Natural Ambient Rope Swaying Physics
    const ropeSway = Math.sin(t * 1.8) * 0.045;
    const ropeLength = 36;
    const beamRopeX = 145;
    const beamRopeY = 18;
    const ropeEndX = beamRopeX + Math.sin(ropeSway) * ropeLength;
    const ropeEndY = beamRopeY + Math.cos(ropeSway) * ropeLength;

    // 2. Always draw the full glowing Neon Gallows Scaffold
    ctx.strokeStyle = isDead ? NEON_DEAD : NEON_GALLOWS;
    applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_GALLOWS_GLOW, 12);
    ctx.lineWidth = 5;

    // Base
    ctx.beginPath();
    ctx.moveTo(15, 225);
    ctx.lineTo(185, 225);
    ctx.stroke();

    // Vertical Mast Pole
    ctx.beginPath();
    ctx.moveTo(55, 225);
    ctx.lineTo(55, 18);
    ctx.stroke();

    // Top Overhead Beam
    ctx.beginPath();
    ctx.moveTo(55, 18);
    ctx.lineTo(155, 18);
    ctx.stroke();

    // Corner Angle Brace Strut
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(55, 50);
    ctx.lineTo(85, 18);
    ctx.stroke();

    // 3. Hanging Rope with Swaying Motion
    ctx.lineWidth = 3;
    ctx.strokeStyle = isDead ? NEON_DEAD : '#f59e0b';
    applyGlow(ctx, isDead ? NEON_DEAD_GLOW : '#f59e0b', 8);
    ctx.beginPath();
    ctx.moveTo(beamRopeX, beamRopeY);
    ctx.lineTo(ropeEndX, ropeEndY);
    ctx.stroke();

    // If 0 mistakes: Draw a dangling rope noose loop swinging gently (no stickman, no dialogues)
    if (mistakes === 0) {
      ctx.beginPath();
      ctx.arc(ropeEndX, ropeEndY + 8, 8, 0, Math.PI * 2);
      ctx.stroke();
      clearGlow(ctx);
      ctx.restore();
      return;
    }

    clearGlow(ctx);

    // 4. Draw Animated Hanging Stickman from Rope End
    ctx.save();
    ctx.translate(ropeEndX, ropeEndY);
    ctx.rotate(ropeSway);

    const isHappy = mood === 'happy';
    const isPanic = mistakes >= 5 && !isDead;
    const isBlinking = Math.sin(t * 1.2) > 0.94;
    const breathOffset = Math.sin(t * 2.5) * 1.2;
    const cheerHopY = isHappy ? -Math.abs(Math.sin(t * 8)) * 5 : 0;

    ctx.translate(0, cheerHopY);

    // ── Head (Mistake >= 1) ──────────────────────────────────
    if (mistakes >= 1) {
      ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
      applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 12);
      ctx.lineWidth = 3.5;

      const headCenterY = 18;
      const headRadius = 16;
      ctx.beginPath();
      ctx.arc(0, headCenterY, headRadius, 0, Math.PI * 2);
      ctx.stroke();
      clearGlow(ctx);

      // Facial Features
      ctx.save();
      if (isDead) {
        // X X dead eyes
        ctx.strokeStyle = NEON_DEAD;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-6, 12); ctx.lineTo(-2, 18);
        ctx.moveTo(-2, 12); ctx.lineTo(-6, 18);
        ctx.moveTo(2, 12);  ctx.lineTo(6, 18);
        ctx.moveTo(6, 12);  ctx.lineTo(2, 18);
        ctx.stroke();
      } else if (isHappy) {
        // Joyful (^_^) smiling eyes
        ctx.strokeStyle = '#22c55e';
        applyGlow(ctx, '#22c55e', 8);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-5, 16, 2.5, Math.PI, 0, false);
        ctx.arc(5, 16, 2.5, Math.PI, 0, false);
        ctx.stroke();
        // Happy open smile
        ctx.beginPath();
        ctx.arc(0, 20, 4.5, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
        clearGlow(ctx);
      } else if (isPanic) {
        // Panic wide eyes
        ctx.fillStyle = NEON_BODY;
        applyGlow(ctx, NEON_BODY, 8);
        ctx.beginPath();
        ctx.arc(-5, 15, isBlinking ? 0.5 : 2.5, 0, Math.PI * 2);
        ctx.arc(5, 15, isBlinking ? 0.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Wavy mouth
        ctx.strokeStyle = NEON_BODY;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 24);
        ctx.quadraticCurveTo(0, 21, 5, 24);
        ctx.stroke();
        // Flying sweat drop
        const sweatY = 8 + ((t * 30) % 20);
        ctx.fillStyle = '#06b6d4';
        applyGlow(ctx, '#06b6d4', 6);
        ctx.beginPath();
        ctx.arc(16, sweatY, 2.2, 0, Math.PI * 2);
        ctx.fill();
        clearGlow(ctx);
      } else {
        // Neutral cute curious eyes
        ctx.fillStyle = NEON_BODY;
        applyGlow(ctx, NEON_BODY, 8);
        ctx.beginPath();
        if (isBlinking) {
          ctx.rect(-6, 15, 3, 1);
          ctx.rect(3, 15, 3, 1);
        } else {
          ctx.arc(-5, 15, 2, 0, Math.PI * 2);
          ctx.arc(5, 15, 2, 0, Math.PI * 2);
        }
        ctx.fill();
        // Calm mouth
        ctx.strokeStyle = NEON_BODY;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 22, 3, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
        clearGlow(ctx);
      }
      ctx.restore();
    }

    // ── Body Torso (Mistake >= 2) ───────────────────────────
    if (mistakes >= 2) {
      ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
      applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 10);
      ctx.lineWidth = 3.5;
      const torsoStartY = 34;
      const torsoEndY = 90 + breathOffset;
      ctx.beginPath();
      ctx.moveTo(0, torsoStartY);
      ctx.lineTo(0, torsoEndY);
      ctx.stroke();
      clearGlow(ctx);

      // ── Left Arm (Mistake >= 3) ───────────────────────────
      if (mistakes >= 3) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 48);
        if (isHappy) {
          ctx.lineTo(-24, 28);
        } else {
          ctx.lineTo(-24, 76 + breathOffset * 0.5);
        }
        ctx.stroke();
        clearGlow(ctx);
      }

      // ── Right Arm (Mistake >= 4) ──────────────────────────
      if (mistakes >= 4) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 48);
        if (isHappy) {
          ctx.lineTo(24, 28);
        } else {
          ctx.lineTo(24, 76 + breathOffset * 0.5);
        }
        ctx.stroke();
        clearGlow(ctx);
      }

      // ── Left Leg (Mistake >= 5) ───────────────────────────
      if (mistakes >= 5) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, torsoEndY);
        ctx.lineTo(-20, torsoEndY + 45);
        ctx.stroke();
        clearGlow(ctx);
      }

      // ── Right Leg (Mistake >= 6) ──────────────────────────
      if (mistakes >= 6) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        applyGlow(ctx, isDead ? NEON_DEAD_GLOW : NEON_BODY, 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, torsoEndY);
        ctx.lineTo(20, torsoEndY + 45);
        ctx.stroke();
        clearGlow(ctx);
      }

      // ── Left Hand Detail (Mistake >= 7) ───────────────────
      if (mistakes >= 7) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (isHappy) {
          ctx.arc(-24, 26, 2.5, 0, Math.PI * 2);
        } else {
          ctx.arc(-24, 78, 2.5, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      // ── Right Hand Detail (Mistake >= 8) ──────────────────
      if (mistakes >= 8) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (isHappy) {
          ctx.arc(24, 26, 2.5, 0, Math.PI * 2);
        } else {
          ctx.arc(24, 78, 2.5, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      // ── Left Foot (Mistake >= 9) ──────────────────────────
      if (mistakes >= 9) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-20, torsoEndY + 45);
        ctx.lineTo(-28, torsoEndY + 46);
        ctx.stroke();
      }

      // ── Right Foot (Mistake >= 10) ────────────────────────
      if (mistakes >= 10) {
        ctx.strokeStyle = isDead ? NEON_DEAD : NEON_BODY;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(20, torsoEndY + 45);
        ctx.lineTo(28, torsoEndY + 46);
        ctx.stroke();
      }
    }

    ctx.restore(); // restore stickman transform

    // ── Floating Dynamic Speech Bubble ───────────────────────
    if (!isDead && dialogue) {
      const isMean = mood === 'mean' || mistakes >= 6;
      const bubbleBorder = mood === 'happy'
        ? 'rgba(34, 197, 94, 0.9)'
        : isMean
        ? 'rgba(239, 68, 68, 0.9)'
        : 'rgba(168, 85, 247, 0.85)';
      const bubbleTextCol = mood === 'happy'
        ? '#4ade80'
        : isMean
        ? '#fca5a5'
        : '#f8fafc';
      drawSpeechBubble(ctx, ropeEndX, ropeEndY + 18, dialogue, 'left', bubbleBorder, 'rgba(15, 23, 42, 0.95)', bubbleTextCol);
    }

    ctx.restore();
  }, []);


  // ── 5-Stage Physics Death Sequence Animation (~3.5s total) ────────────────
  //
  //  Stage 1 [0.00 – 0.30s] Trapdoor Drop      – base splits with hinge physics
  //  Stage 2 [0.30 – 0.50s] Sudden Drop + Jerk – body drops, rope jerks taut
  //  Stage 3 [0.50 – 2.50s] Pendulum Ragdoll   – θ(t) = θ_max·e^(−γt)·cos(ωt)
  //  Stage 4 [2.50 – 3.20s] Rope Snap + Fall   – frayed stub, gravity free-fall
  //  Stage 5 [3.20s+]       Modal Trigger       – only after body leaves canvas
  const runDeathAnimation = useCallback((canvas, callback) => {
    if (!canvas) { callback?.(); return; }
    stopDialogue();
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

    // Display savage final dramatic insult
    stopDialogue();
    const deathPhrase = getRandomPhrase(DEATH_PHRASES, currentDialogueRef.current);
    setCurrentDialogue(deathPhrase);
    currentDialogueRef.current = deathPhrase;
    setStickmanMood('mean');

    const fireCallback = () => {
      if (!callbackFired) {
        callbackFired = true;
        clearTimeout(safetyTimer);
        if (specialAnimIdRef.current) {
          cancelAnimationFrame(specialAnimIdRef.current);
          specialAnimIdRef.current = null;
        }
        callback?.();
      }
    };

    const safetyTimer = setTimeout(() => {
      fireCallback();
    }, (T_MODAL + 0.5) * 1000);

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
      if (token !== currentRoundTokenRef.current) {
        fireCallback();
        return;
      }

      try {
        const elapsed = (now - startTime) / 1000; // seconds

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const scale = canvas.width / 220;
        ctx.scale(scale, scale);
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
          specialAnimIdRef.current = null;
          // Small grace delay so the canvas is visually clear before modal appears
          setTimeout(() => fireCallback(), 300);
          return; // stop rAF loop
        }

        // Hard fallback: fire modal at T_MODAL even if geometry is off
        if (elapsed >= T_MODAL && !callbackFired) {
          specialAnimIdRef.current = null;
          fireCallback();
          return;
        }

        specialAnimIdRef.current = requestAnimationFrame(animate);
      } catch (err) {
        console.error('Death animation error:', err);
        fireCallback();
      }
    }

    specialAnimIdRef.current = requestAnimationFrame(animate);
  }, []);

  // ── "The Great Escape" Multi-Phase Victory Sequence Animation (~2.8s) ──────
  const runEscapeAnimation = useCallback((canvas, livesLeft, maxLives, callback) => {
    if (!canvas) { callback?.(); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { callback?.(); return; }

    const wrongGuessesCount = maxLives - livesLeft;
    const startTime = performance.now();
    const DURATION = 2800; // 2.8s multi-phase sequence
    const dustParticles = [];
    const token = currentRoundTokenRef.current;
    stopDialogue();

    // Pick a celebratory survival speech bubble phrase
    const escapePhrase = getRandomPhrase(ESCAPE_PHRASES, currentDialogueRef.current);

    let callbackFired = false;
    const fireCallback = () => {
      if (!callbackFired) {
        callbackFired = true;
        clearTimeout(safetyTimer);
        if (specialAnimIdRef.current) {
          cancelAnimationFrame(specialAnimIdRef.current);
          specialAnimIdRef.current = null;
        }
        callback?.();
      }
    };

    // Failsafe timer: guarantees callback executes even if canvas or rAF gets interrupted
    const safetyTimer = setTimeout(() => {
      fireCallback();
    }, DURATION + 200);

    function animate(now) {
      if (token !== currentRoundTokenRef.current) {
        fireCallback();
        return;
      }

      try {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / DURATION);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const scale = canvas.width / 220;
        ctx.scale(scale, scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Static gallows parts (always draw glowing gallows clearly)
        ctx.strokeStyle = NEON_GALLOWS;
        applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(20, 225); ctx.lineTo(90, 225);
        ctx.moveTo(55, 225); ctx.lineTo(55, 18); ctx.lineTo(145, 18);
        ctx.stroke();
        clearGlow(ctx);

        // Broken snapped rope dangling
        ctx.strokeStyle = '#f59e0b';
        applyGlow(ctx, 'rgba(245, 158, 11, 0.7)', 8);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(145, 18); ctx.lineTo(145, 30);
        ctx.stroke();
        clearGlow(ctx);

        // Ground Line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 225); ctx.lineTo(canvas.width, 225);
        ctx.stroke();

        // 2. Kinematics across 3 Timed Phases:
        // Phase 1 (0ms - 350ms): Drop to floor
        // Phase 2 (350ms - 1700ms): Pause & Speak (1.35s grateful pause with happy face & bubble)
        // Phase 3 (1700ms - 2800ms): Escape Sprint off-screen
        const groundY = 225;
        let figX = 145;
        let hipY = 178;
        let legCycle = 0;
        let isRunning = false;
        let showSpeechBubble = false;

        if (elapsed < 350) {
          // Phase 1: Drop
          const dropP = elapsed / 350;
          hipY = 135 + dropP * dropP * 43;
        } else if (elapsed < 1700) {
          // Phase 2: Pause & Speak
          hipY = 178;
          figX = 145;
          showSpeechBubble = true;
        } else {
          // Phase 3: Escape Sprint
          isRunning = true;
          showSpeechBubble = false;
          const runElapsed = elapsed - 1700;
          figX = 145 + runElapsed * (0.24 + (runElapsed / 1000) * 0.28);
          legCycle = runElapsed * 0.024;
          hipY = 176 + Math.sin(legCycle * 2) * 3.5;
        }

        // Dust particles kick-up during sprint
        if (isRunning && Math.random() < 0.4 && dustParticles.length < 16) {
          dustParticles.push({
            x: figX - 8 + (Math.random() - 0.5) * 6,
            y: groundY - 2 + Math.random() * 4,
            vx: -(1.5 + Math.random() * 2.5),
            vy: -(0.5 + Math.random()),
            alpha: 0.85,
            radius: 1.5 + Math.random() * 2.5
          });
        }

        dustParticles.forEach((d) => {
          d.x += d.vx;
          d.y += d.vy;
          d.alpha -= 0.035;
          if (d.alpha > 0) {
            ctx.fillStyle = `rgba(16, 185, 129, ${d.alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // 3. Draw Victorious Green Stick Figure
        const NEON_WIN_BODY = '#10b981';
        ctx.strokeStyle = NEON_WIN_BODY;
        applyGlow(ctx, 'rgba(16, 185, 129, 0.6)', 14);

        const forwardTilt = isRunning ? 6 : 0;
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

        // Happy Smiling Face (^ ^ and :D)
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = NEON_WIN_BODY;
        if (showSpeechBubble || !isRunning) {
          // Happy ^ ^ eyes
          ctx.beginPath();
          ctx.moveTo(figX + forwardTilt - 8, headCy - 2);
          ctx.lineTo(figX + forwardTilt - 4, headCy - 6);
          ctx.lineTo(figX + forwardTilt, headCy - 2);

          ctx.moveTo(figX + forwardTilt, headCy - 2);
          ctx.lineTo(figX + forwardTilt + 4, headCy - 6);
          ctx.lineTo(figX + forwardTilt + 8, headCy - 2);
          ctx.stroke();

          // Big smile
          ctx.beginPath();
          ctx.arc(figX + forwardTilt, headCy + 2, 8, 0.1 * Math.PI, 0.9 * Math.PI, false);
          ctx.stroke();
        } else {
          // Running eyes & smile
          ctx.fillStyle = NEON_WIN_BODY;
          ctx.beginPath();
          ctx.arc(figX + forwardTilt + 2, headCy - 3, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(figX + forwardTilt, headCy + 2, 7, 0.1 * Math.PI, 0.9 * Math.PI, false);
          ctx.stroke();
        }

        // Arms
        const shoulderY = neckY + 10;
        ctx.lineWidth = 3.5;
        if (showSpeechBubble) {
          // Cheering / raised arms in gratitude (\o/)
          ctx.beginPath();
          ctx.moveTo(figX + forwardTilt, shoulderY);
          ctx.lineTo(figX - 18, shoulderY - 20);
          ctx.moveTo(figX + forwardTilt, shoulderY);
          ctx.lineTo(figX + 18, shoulderY - 20);
          ctx.stroke();
        } else if (!isRunning) {
          ctx.beginPath();
          ctx.moveTo(figX + forwardTilt, shoulderY);
          ctx.lineTo(figX - 14, shoulderY + 18);
          ctx.moveTo(figX + forwardTilt, shoulderY);
          ctx.lineTo(figX + 14, shoulderY + 18);
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

        // Legs
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

        // Phase 2 Grateful Speech Bubble (dynamic text width & boundary clamped)
        if (showSpeechBubble) {
          drawSpeechBubble(ctx, figX, headCy, escapePhrase, 'left', 'rgba(16, 185, 129, 0.85)', 'rgba(6, 78, 59, 0.95)', '#ecfdf5');
        }

        if (progress < 1) {
          specialAnimIdRef.current = requestAnimationFrame(animate);
        } else {
          specialAnimIdRef.current = null;
          fireCallback();
        }
      } catch (err) {
        console.error('Escape animation error:', err);
        fireCallback();
      }
    }

    specialAnimIdRef.current = requestAnimationFrame(animate);
  }, [ESCAPE_PHRASES]);

  // ── Trigger Happy Stickman Expression on Correct Guess ────────────────────
  const triggerHappyGuess = useCallback(() => {
    if (dialogueTimeoutRef.current) clearTimeout(dialogueTimeoutRef.current);

    const phrase = getRandomPhrase(HAPPY_GUESS_PHRASES, currentDialogueRef.current);
    setCurrentDialogue(phrase);
    setStickmanMood('happy');
    currentDialogueRef.current = phrase;
    stickmanMoodRef.current = 'happy';

    dialogueTimeoutRef.current = setTimeout(() => {
      const idle = getRandomPhrase(INITIAL_IDLE_PHRASES, currentDialogueRef.current);
      setCurrentDialogue(idle);
      currentDialogueRef.current = idle;
      setStickmanMood('neutral');
      stickmanMoodRef.current = 'neutral';
    }, 4000);
  }, []);

  // ── Trigger Mean / Sarcastic Stickman Roast on Wrong Guess ────────────────
  const triggerMeanWrongGuess = useCallback((mistakesCount = 1) => {
    if (dialogueTimeoutRef.current) clearTimeout(dialogueTimeoutRef.current);

    const livesLeft = Math.max(0, MAX_LIVES - mistakesCount);
    let phrase;
    if (livesLeft <= 1 || mistakesCount >= 8) {
      phrase = getRandomPhrase(DANGER_PHRASES, currentDialogueRef.current);
      setStickmanMood('panic');
      stickmanMoodRef.current = 'panic';
    } else {
      phrase = getRandomPhrase(MEAN_WRONG_PHRASES, currentDialogueRef.current);
      setStickmanMood('mean');
      stickmanMoodRef.current = 'mean';
    }

    setCurrentDialogue(phrase);
    currentDialogueRef.current = phrase;

    dialogueTimeoutRef.current = setTimeout(() => {
      const idle = getRandomPhrase(INITIAL_IDLE_PHRASES, currentDialogueRef.current);
      setCurrentDialogue(idle);
      currentDialogueRef.current = idle;
      setStickmanMood('neutral');
      stickmanMoodRef.current = 'neutral';
    }, 4000);
  }, []);

  // ── Apply Room State Updates ──────────────────────────────────────────────
  const applyState = useCallback((roomData) => {
    if (!roomData) return;
    if (roomData.status) {
      setRoomStatus(roomData.status);
    } else if (roomData.state === 'lobby' || roomData.state === 'waiting') {
      setRoomStatus('waiting');
    } else if (['setting', 'guessing', 'roundover', 'gameover'].includes(roomData.state)) {
      setRoomStatus('playing');
    }
    setGameState(roomData.state);
    if (roomData.players) setPlayers(roomData.players);
    if (roomData.teamA) setTeamA(roomData.teamA);
    if (roomData.teamB) setTeamB(roomData.teamB);
    if (roomData.teamNameA) setTeamNameA(roomData.teamNameA);
    if (roomData.teamNameB) setTeamNameB(roomData.teamNameB);
    if (roomData.leaderA !== undefined) setLeaderA(roomData.leaderA);
    if (roomData.leaderB !== undefined) setLeaderB(roomData.leaderB);
    if (roomData.teamScores) setTeamScores(roomData.teamScores);
    if (roomData.currentTurn) setCurrentTurnTeam(roomData.currentTurn);
    if (roomData.wordSettingTeam) setWordSettingTeam(roomData.wordSettingTeam);
    if (roomData.myTeam) setMyTeam(roomData.myTeam);
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

      // Trigger happy stickman reaction on correct letter guess
      if (newG.length > 0 && newW.length === 0 && prevGuessedRef.current.length > 0) {
        triggerHappyGuess();
      }

      // Trigger mean stickman roast and gallows swing on wrong guess
      if (newW.length > 0) {
        triggerMeanWrongGuess(currentWrong.length);
        setIsGallowsSwinging(true);
        setTimeout(() => setIsGallowsSwinging(false), 900);
      }

      prevGuessedRef.current = [...currentGuessed];
      prevWrongRef.current = [...currentWrong];
    }

    // ── Round Over Special Transitions ──────────────────────────────────────
    if (roomData.state === 'roundover') {
      if (roundOverHandledRef.current || isRoundOverModalOpenRef.current) {
        return;
      }
      roundOverHandledRef.current = true;
      currentRoundTokenRef.current++;

      const setterWon = roomData.game?.roundResult === 'setter_wins';
      const guesserWon = roomData.game?.roundResult === 'guesser_wins';
      const isSetter = roomData.game ? (roomData.game.wordSetterId === myPlayerId) : false;

      // Master fallback timer: Under all circumstances, open the modal within 3.2s
      const safetyFallback = setTimeout(() => {
        setIsRoundOverModalOpen(true);
        isRoundOverModalOpenRef.current = true;
      }, 3200);

      const openModal = () => {
        clearTimeout(safetyFallback);
        setIsRoundOverModalOpen(true);
        isRoundOverModalOpenRef.current = true;
      };

      // Explicitly target the canvas that is active and mounted for the player's role
      const activeCanvas = isSetter ? hangmanWatchCanvasRef.current : hangmanCanvasRef.current;

      if (setterWon) {
        // 1. Environmental Screen Shake & Red Flash
        setIsScreenShaking(true);
        setIsScreenFlashing(true);
        setTimeout(() => setIsScreenShaking(false), 550);
        setTimeout(() => setIsScreenFlashing(false), 800);

        // 2. Hanging Trapdoor & Rope-Snap Physics Animation
        if (activeCanvas) {
          runDeathAnimation(activeCanvas, openModal);
        } else {
          openModal();
        }
      } else if (guesserWon) {
        // 1. Celebration Confetti Shower for winning guesser
        if (!isSetter) {
          triggerConfettiShower();
        }
        // 2. The Great Escape Sprint Animation
        if (activeCanvas) {
          runEscapeAnimation(activeCanvas, roomData.game?.livesLeft ?? 10, roomData.game?.maxLives || 10, openModal);
        } else {
          openModal();
        }
      } else {
        openModal();
      }
    } else {
      roundOverHandledRef.current = false;
      isRoundOverModalOpenRef.current = false;
      setIsRoundOverModalOpen(false);
      setIsWaitingOpponent(false);
    }
  }, [myPlayerId, triggerConfettiShower, triggerHappyGuess, triggerMeanWrongGuess, runDeathAnimation, runEscapeAnimation]);

  // ── Forceful Reset / Modal Close on Round Transition (Anti-Softlock) ─────
  const forceResetRoundState = useCallback(() => {
    currentRoundTokenRef.current++;
    roundOverHandledRef.current = false;
    isRoundOverModalOpenRef.current = false;
    setIsRoundOverModalOpen(false);
    setIsWaitingOpponent(false);
    setSetterWordSubmitted(false);
    setSecretWordInput('');
    setWordValidationMsg('');
    setLiveWordDef(null);
    setIsLookingUpDef(false);
    if (specialAnimIdRef.current) {
      cancelAnimationFrame(specialAnimIdRef.current);
      specialAnimIdRef.current = null;
    }
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

  // ── 3. Dynamic Stickman Reaction Hook (Guessed Letters & Lives Listener) ───
  const prevGuessedLettersRef = useRef([]);

  useEffect(() => {
    // Only react during active guessing phase
    if (gameState !== 'guessing' || !game) {
      prevGuessedLettersRef.current = [];
      if (dialogueTimeoutRef.current) {
        clearTimeout(dialogueTimeoutRef.current);
      }
      return;
    }

    const currentGuessed = Array.isArray(game.guessedLetters) ? game.guessedLetters : [];
    const prevGuessed = prevGuessedLettersRef.current;
    const secretWord = (game.word || '').toUpperCase();
    const lives = game.livesLeft !== undefined
      ? game.livesLeft
      : Math.max(0, MAX_LIVES - (game.wrongGuesses?.length || 0));

    // When a new letter is guessed
    if (currentGuessed.length > prevGuessed.length) {
      const latestLetter = currentGuessed[currentGuessed.length - 1];

      // Check if latest guessed letter is in the secret word
      const isCorrect = secretWord
        ? secretWord.includes(latestLetter)
        : Array.isArray(game.wrongGuesses) ? !game.wrongGuesses.includes(latestLetter) : true;

      // Clear any pending idle reset timer
      if (dialogueTimeoutRef.current) {
        clearTimeout(dialogueTimeoutRef.current);
      }

      let selectedPhrase = '';

      // If lives === 1, override and pick from DANGER_PHRASES
      if (lives === 1) {
        selectedPhrase = getRandomPhrase(DANGER_PHRASES, currentDialogueRef.current);
        setStickmanMood('panic');
        stickmanMoodRef.current = 'panic';
      } else if (!isCorrect) {
        // If latest guessed letter is NOT in secretWord
        selectedPhrase = getRandomPhrase(MEAN_WRONG_PHRASES, currentDialogueRef.current);
        setStickmanMood('mean');
        stickmanMoodRef.current = 'mean';
      } else {
        // If latest guessed letter IS in secretWord
        selectedPhrase = getRandomPhrase(HAPPY_GUESS_PHRASES, currentDialogueRef.current);
        setStickmanMood('happy');
        stickmanMoodRef.current = 'happy';
      }

      setCurrentDialogue(selectedPhrase);
      currentDialogueRef.current = selectedPhrase;

      // Set timeout to return to INITIAL_IDLE_PHRASES state after 4 seconds of inactivity
      dialogueTimeoutRef.current = setTimeout(() => {
        const idlePhrase = getRandomPhrase(INITIAL_IDLE_PHRASES, currentDialogueRef.current);
        setCurrentDialogue(idlePhrase);
        currentDialogueRef.current = idlePhrase;
        setStickmanMood('neutral');
        stickmanMoodRef.current = 'neutral';
      }, 4000);
    }

    prevGuessedLettersRef.current = [...currentGuessed];
  }, [game?.guessedLetters, game?.livesLeft, game?.wrongGuesses, game?.word, gameState]);

  // ── Stickman Dialogue Speech Synthesizer ─────────────────────────────────
  // ONLY active during the active guessing phase AND only for the guesser (never in word selector POV)
  useEffect(() => {
    if (gameState === 'guessing' && !isWordSetter && currentDialogue) {
      speakDialogue(currentDialogue);
    }
  }, [gameState, isWordSetter, currentDialogue]);

  // Immediately cancel any dialogue speech whenever leaving the guessing phase or in word selector POV
  useEffect(() => {
    if (gameState !== 'guessing' || isWordSetter) {
      stopDialogue();
    }
  }, [gameState, isWordSetter]);

  // ── Real-Time Online Dictionary Definition Lookup for Word Setter ─────────
  useEffect(() => {
    const clean = (secretWordInput || '').trim().toUpperCase();
    if (clean.length < 3 || !/^[A-Z]+$/.test(clean)) {
      setLiveWordDef(null);
      setIsLookingUpDef(false);
      return;
    }

    setIsLookingUpDef(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/dictionary/define?word=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data && data.found) {
          setLiveWordDef(data);
        } else {
          setLiveWordDef({
            word: clean,
            found: false,
            reason: data?.reason || `No dictionary definition found for "${clean}".`
          });
        }
      } catch {
        setLiveWordDef({
          word: clean,
          found: false,
          reason: 'Unable to connect to dictionary services.'
        });
      } finally {
        setIsLookingUpDef(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [secretWordInput]);

  // ── Setup Reusable Event Listeners Binding Helper ────────────────────────
  const attachSocketListeners = useCallback((sock) => {
    if (!sock) return () => {};

    const onConnect = () => {
      const sessId = isBackendConfigured() ? (getSessionId() || sock.id) : sock.id;
      console.log(`✅ [Socket Connected] Successfully connected to backend: ${getBackendUrl()} (Socket ID: ${sock.id}, Session ID: ${sessId})`);
      if (wakeUpTimerRef.current) clearTimeout(wakeUpTimerRef.current);
      setConnectionStatus('connected');
      setMyPlayerId(sessId);
      setLobbyError('');
    };

    const onConnectError = (err) => {
      console.warn('ℹ️ [Socket.io Handshake Notice]: Backend taking time to respond or waking up.', err.message);
      setConnectionStatus('waking_up');
    };

    const onDisconnect = (reason) => {
      console.warn(`🔌 [Socket Disconnected] Reason: ${reason}`);
      setConnectionStatus('connecting');
      if (reason === 'io server disconnect' && typeof sock.connect === 'function') {
        sock.connect();
      }
    };

    const onGameRestored = (restoredData) => {
      console.log('🔄 [Game Restored] Active session restored from backend:', restoredData);
      setIsConnecting(false);
      setDisconnectNotice(null);
      if (restoredData.roomCode) setRoomCode(restoredData.roomCode);
      if (restoredData.state === 'lobby') {
        setScreen('waiting');
      } else if (restoredData.state && restoredData.state !== 'lobby') {
        setScreen('game');
      }
      applyState(restoredData);
      showToast('🔄 Reconnected to active game!', 3000);
    };

    const onPlayerDisconnected = ({ playerName, gracePeriodSeconds }) => {
      console.warn(`⏳ [Player Disconnected] ${playerName} disconnected. Waiting ${gracePeriodSeconds}s...`);
      setDisconnectNotice({
        name: playerName || 'Opponent',
        secondsLeft: gracePeriodSeconds || 60,
      });
      showToast(`⏳ ${playerName || 'Opponent'} temporarily disconnected. Waiting for reconnection...`, 4000);
    };

    const onPlayerReconnected = ({ name }) => {
      console.log(`✅ [Player Reconnected] ${name} has reconnected.`);
      setDisconnectNotice(null);
      showToast(`✅ ${name || 'Opponent'} reconnected!`, 3000);
    };

    const onPlayerForfeit = ({ message }) => {
      setDisconnectNotice(null);
      showToast(`🏆 ${message || 'Opponent did not reconnect. You win by default!'}`, 5000);
    };

    const onRoomCreated = ({ roomCode: code }) => {
      setIsConnecting(false);
      setRoomCode(code);
      setScreen('waiting');
      setRoomStatus('waiting');
      setGameState('waiting');
    };

    const onGameStart = ({ roomCode: code, players: roomPlayers }) => {
      setIsConnecting(false);
      if (code) setRoomCode(code);
      if (roomPlayers) setPlayers(roomPlayers);
      setScreen('game');
      setRoomStatus('playing');
      setGameState('setting');
    };

    const onStateUpdate = (roomState) => {
      if (roomState?.status === 'playing' || (roomState?.state && !['lobby', 'waiting'].includes(roomState.state))) {
        setScreen('game');
        setRoomStatus('playing');
      } else if (roomState?.status === 'waiting' || roomState?.state === 'lobby') {
        setRoomStatus('waiting');
      }
      applyState(roomState);
    };

    const onUpdateRoom = (roomData) => {
      if (roomData) {
        applyState(roomData);
      }
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
      setDisconnectNotice(null);
      showToast('⚠️ Opponent left the game.', 4000);
      setGameState('lobby');
      setRoomStatus('waiting');
      setScreen('waiting');
    };

    const onJoinError = (err) => {
      setIsConnecting(false);
      setIsJoining(false);
      const message =
        typeof err === 'string'
          ? err
          : err?.message || 'Name already taken in this room. Please choose another.';
      setLobbyError(message);
      showToast(`⚠️ ${message}`, 4500);
    };

    const onErrorMsg = (msg) => {
      setIsConnecting(false);
      const text = typeof msg === 'string' ? msg : msg?.message || 'An error occurred.';
      showToast(`⚠️ ${text}`, 3000);
      setLobbyError(text);
    };

    const onStatsUpdate = (newStats) => {
      if (newStats) {
        setLiveStats((prev) => {
          const merged = {
            ...prev,
            ...newStats,
            duelsPlayed: Math.max(prev.duelsPlayed || 0, newStats.duelsPlayed || 0),
            wordsGuessed: Math.max(prev.wordsGuessed || 0, newStats.wordsGuessed || 0),
            totalGuesses: Math.max(prev.totalGuesses || 0, newStats.totalGuesses || 0),
            correctGuesses: Math.max(prev.correctGuesses || 0, newStats.correctGuesses || 0),
            activePlayers: Math.max(1, newStats.activePlayers || 1),
            winRate: newStats.winRate || prev.winRate || 100,
          };
          try { localStorage.setItem('hangman_duel_live_stats', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
    };

    // Immediate sync if already connected
    if (sock.connected) {
      onConnect();
    }

    sock.on('connect', onConnect);
    sock.on('connect_error', onConnectError);
    sock.on('disconnect', onDisconnect);
    sock.on('game_restored', onGameRestored);
    sock.on('player_disconnected', onPlayerDisconnected);
    sock.on('player_reconnected', onPlayerReconnected);
    sock.on('player_forfeit', onPlayerForfeit);
    sock.on('room_created', onRoomCreated);
    sock.on('game_start', onGameStart);
    sock.on('start_game', onGameStart);
    sock.on('update_room', onUpdateRoom);
    sock.on('state_update', onStateUpdate);
    sock.on('timer_tick', onTimerTick);
    sock.on('timer_expired', onTimerExpired);
    sock.on('round_started', onRoundStarted);
    sock.on('round_transitioning', onRoundTransitioning);
    sock.on('word_suggestions', onWordSuggestions);
    sock.on('word_validation', onWordValidation);
    sock.on('opponent_left', onOpponentLeft);
    sock.on('error_msg', onErrorMsg);
    sock.on('join_error', onJoinError);
    sock.on('stats_update', onStatsUpdate);

    return () => {
      sock.off('connect', onConnect);
      sock.off('connect_error', onConnectError);
      sock.off('disconnect', onDisconnect);
      sock.off('game_restored', onGameRestored);
      sock.off('player_disconnected', onPlayerDisconnected);
      sock.off('player_reconnected', onPlayerReconnected);
      sock.off('player_forfeit', onPlayerForfeit);
      sock.off('room_created', onRoomCreated);
      sock.off('game_start', onGameStart);
      sock.off('start_game', onGameStart);
      sock.off('update_room', onUpdateRoom);
      sock.off('state_update', onStateUpdate);
      sock.off('timer_tick', onTimerTick);
      sock.off('timer_expired', onTimerExpired);
      sock.off('round_started', onRoundStarted);
      sock.off('round_transitioning', onRoundTransitioning);
      sock.off('word_suggestions', onWordSuggestions);
      sock.off('word_validation', onWordValidation);
      sock.off('opponent_left', onOpponentLeft);
      sock.off('error_msg', onErrorMsg);
      sock.off('join_error', onJoinError);
      sock.off('stats_update', onStatsUpdate);
    };
  }, [applyState, forceResetRoundState, showToast]);

  // ── Setup Socket.io Connection & Cold-Start LifeCycle ───────────────────
  useEffect(() => {
    // 1. Send fast HTTP GET wake-up ping to Render backend if configured
    const backendUrl = getBackendUrl();
    if (backendUrl) {
      console.log('📡 Pinging backend health endpoint:', `${backendUrl}/health`);
      fetch(`${backendUrl}/health`, { mode: 'cors' })
        .then((res) => {
          if (res.ok) console.log('✅ Backend HTTP health check OK');
        })
        .catch((err) => {
          console.log('ℹ️ Backend health check ping sent (server warming up):', err.message);
        });
    }

    let socket;

    if (!isBackendConfigured()) {
      // ── No backend configured: use built-in P2P/serverless mode ──────────
      if (!socketRef.current) {
        console.log('ℹ️ [Mode: P2P] No NEXT_PUBLIC_BACKEND_URL set. Using serverless P2P mode.');
        socket = new ServerlessSocket();
        socketRef.current = socket;
      } else {
        socket = socketRef.current;
      }
      setConnectionStatus('connected');
      setMyPlayerId(socket.id);
      setLobbyError('');
    } else {
      // ── Backend configured: connect via Socket.io ─────────────────────────
      socket = getSocket();
      if (!socket) return;
      socketRef.current = socket;

      if (socket.connected) {
        setConnectionStatus('connected');
        const sessId = getSessionId() || socket.id;
        setMyPlayerId(sessId);
      } else {
        setConnectionStatus('connecting');
        wakeUpTimerRef.current = setTimeout(() => {
          if (!socket.connected) {
            console.warn('⏳ [Server Cold-Start] Backend server taking >4s to respond (instant P2P fallback active).');
            setConnectionStatus('waking_up');
          }
        }, 4000);
      }
    }

    const cleanup = attachSocketListeners(socket);

    return () => {
      if (wakeUpTimerRef.current) clearTimeout(wakeUpTimerRef.current);
      cleanup();
    };
  }, [attachSocketListeners]);

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

  // ── 1. Clear Ghost Canvas on Round Reset / New Game ──────────────────────
  useEffect(() => {
    if (
      gameState === 'setting' ||
      gameState === 'waiting' ||
      gameState === 'lobby' ||
      !game ||
      game.livesLeft === MAX_LIVES ||
      (game.wrongGuesses && game.wrongGuesses.length === 0)
    ) {
      if (specialAnimIdRef.current) {
        cancelAnimationFrame(specialAnimIdRef.current);
        specialAnimIdRef.current = null;
      }
      [hangmanCanvasRef.current, hangmanWatchCanvasRef.current].forEach((canvas) => {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      });
      canvasAnimStateRef.current = { drawnSteps: 0, animId: null };
      watchCanvasAnimStateRef.current = { drawnSteps: 0, animId: null };
    }
  }, [gameState, game?.word, game?.livesLeft, pveRound]);

  // ── 1. Create Room (Authoritative Socket.io with Auto-Connect Queue & Timeout) ─
  const handleCreateRoom = () => {
    const name = playerName.trim();
    if (!name) {
      setLobbyError('Please enter your name first.');
      showToast('Please enter your name first! ✏️');
      return;
    }

    const chosenTeam = activeMode === 'team' ? selectedTeam : 'teamA';
    setLobbyError('');
    setIsPveMode(false);
    setIsConnecting(true);

    if (isBackendConfigured()) {
      const sock = socketRef.current || getSocket();
      if (!sock) {
        setLobbyError('Could not initialize connection to game backend.');
        setIsConnecting(false);
        return;
      }
      socketRef.current = sock;
      attachSocketListeners(sock);

      if (sock.connected) {
        showToast('Creating room… 🎮');
        sock.emit('create_room', { playerName: name, wordPickTime, team: chosenTeam });
        setTimeout(() => { setIsConnecting(false); }, 15000);
        return;
      }

      // Socket is still connecting (Render free tier cold start takes ~20-35s)
      showToast('Waking up game server… Please wait ⏳', 5000);
      setConnectionStatus('connecting');

      let timeoutId;
      let progressTimer1;
      let progressTimer2;

      const clearAllTimers = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (progressTimer1) clearTimeout(progressTimer1);
        if (progressTimer2) clearTimeout(progressTimer2);
      };

      const onConnectEmit = () => {
        clearAllTimers();
        setConnectionStatus('connected');
        setMyPlayerId(sock.id);
        showToast('Connected! Creating room… 🎮', 2000);
        sock.emit('create_room', { playerName: name, wordPickTime, team: chosenTeam });
      };

      sock.once('connect', onConnectEmit);

      // Progress toasts during Render cold boot
      progressTimer1 = setTimeout(() => {
        if (!sock.connected) showToast('Still waking up server… (~15s left) 🚀', 6000);
      }, 10000);

      progressTimer2 = setTimeout(() => {
        if (!sock.connected) showToast('Almost ready, finalizing connection… ⚡', 6000);
      }, 22000);

      // 35-second safety timeout
      timeoutId = setTimeout(() => {
        clearAllTimers();
        sock.off('connect', onConnectEmit);
        if (!sock.connected) {
          console.warn('⚠️ Backend connection timed out. Falling back to P2P mode.');
          showToast(`⚠️ Could not reach server (${getBackendUrl()}). Falling back to P2P mode…`, 6000);
          const p2pSocket = new ServerlessSocket();
          socketRef.current = p2pSocket;
          setConnectionStatus('connected');
          setMyPlayerId(p2pSocket.id);
          attachSocketListeners(p2pSocket);
          p2pSocket.emit('create_room', { playerName: name, wordPickTime, team: chosenTeam });
        }
      }, 35000);

      setTimeout(() => { setIsConnecting(false); }, 40000);
      return;
    }

    // Fallback: If no backend configured at all, use ServerlessSocket
    console.log('⚡ [P2P Mode] No backend configured. Using ServerlessSocket.');
    const p2pSocket = new ServerlessSocket();
    socketRef.current = p2pSocket;
    setConnectionStatus('connected');
    setMyPlayerId(p2pSocket.id);
    attachSocketListeners(p2pSocket);
    p2pSocket.emit('create_room', { playerName: name, wordPickTime, team: chosenTeam });
    setTimeout(() => { setIsConnecting(false); }, 15000);
  };

  // ── 2. Join Room (Authoritative Socket.io with Auto-Connect Queue & Acknowledgment Loop) ───
  const handleJoinRoom = () => {
    const name = playerName.trim();
    const code = (joinCode || '').replace(/\s+/g, '').trim().toUpperCase();
    if (!name) {
      setLobbyError('Please enter your name first.');
      showToast('Please enter your name first! ✏️');
      return;
    }
    if (!code || code.length < 4) {
      setLobbyError('Enter a valid room code.');
      showToast('Please enter a 5-6 letter room code! 🔑');
      return;
    }

    const chosenTeam = selectedTeam || 'teamB';
    setLobbyError('');
    setIsPveMode(false);
    setIsConnecting(true);
    setIsJoining(true);

    // Strict Socket.io Acknowledgment Callback Loop
    const handleJoinResponse = (response) => {
      setIsConnecting(false);
      setIsJoining(false);

      if (!response) {
        setLobbyError('No response received from game server.');
        showToast('⚠️ No response received from game server.', 4000);
        return;
      }

      if (response.success) {
        setLobbyError('');
        const activeRoom = response.room;
        if (activeRoom) {
          applyState(activeRoom);
        }
        setRoomCode(activeRoom?.roomCode || code);
        setGameState('waiting');
        setRoomStatus('waiting');
        setScreen('waiting');
        showToast('Joined team room! 🎮', 3000);
      } else {
        const errorMsg = response.message || 'Room is full or unavailable.';
        setLobbyError(errorMsg);
        showToast(`⚠️ ${errorMsg}`, 4000);
      }
    };

    if (isBackendConfigured()) {
      const sock = socketRef.current || getSocket();
      if (!sock) {
        setLobbyError('Could not initialize connection to game backend.');
        setIsConnecting(false);
        setIsJoining(false);
        return;
      }
      socketRef.current = sock;
      attachSocketListeners(sock);

      if (sock.connected) {
        showToast('Joining game room… 🎯');
        sock.emit('join_room', { roomCode: code, team: chosenTeam, name, playerName: name }, handleJoinResponse);
        setTimeout(() => {
          setIsConnecting(false);
          setIsJoining(false);
        }, 15000);
        return;
      }

      showToast('Waking up game server… Please wait ⏳', 5000);
      setConnectionStatus('connecting');

      let timeoutId;
      let progressTimer1;
      let progressTimer2;

      const clearAllTimers = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (progressTimer1) clearTimeout(progressTimer1);
        if (progressTimer2) clearTimeout(progressTimer2);
      };

      const onConnectJoin = () => {
        clearAllTimers();
        setConnectionStatus('connected');
        setMyPlayerId(sock.id);
        showToast('Connected! Joining room… 🎯', 2000);
        sock.emit('join_room', { roomCode: code, team: chosenTeam, name, playerName: name }, handleJoinResponse);
      };

      sock.once('connect', onConnectJoin);

      progressTimer1 = setTimeout(() => {
        if (!sock.connected) showToast('Still waking up server… (~15s left) 🚀', 6000);
      }, 10000);

      progressTimer2 = setTimeout(() => {
        if (!sock.connected) showToast('Almost ready, finalizing connection… ⚡', 6000);
      }, 22000);

      timeoutId = setTimeout(() => {
        clearAllTimers();
        sock.off('connect', onConnectJoin);
        if (!sock.connected) {
          console.warn('⚠️ Backend connection timed out. Falling back to P2P mode.');
          showToast(`⚠️ Could not reach server (${getBackendUrl()}). Falling back to P2P mode…`, 6000);
          const p2pSocket = new ServerlessSocket();
          socketRef.current = p2pSocket;
          setConnectionStatus('connected');
          setMyPlayerId(p2pSocket.id);
          attachSocketListeners(p2pSocket);
          p2pSocket.emit('join_room', { roomCode: code, team: chosenTeam, name, playerName: name }, handleJoinResponse);
        }
      }, 35000);

      setTimeout(() => {
        setIsConnecting(false);
        setIsJoining(false);
      }, 40000);
      return;
    }

    // Fallback: If no backend configured at all, use ServerlessSocket
    console.log(`⚡ [P2P Mode] Joining room ${code} via ServerlessSocket...`);
    const p2pSocket = new ServerlessSocket();
    socketRef.current = p2pSocket;
    setConnectionStatus('connected');
    setMyPlayerId(p2pSocket.id);
    attachSocketListeners(p2pSocket);
    p2pSocket.emit('join_room', { roomCode: code, team: chosenTeam, name, playerName: name }, handleJoinResponse);
    setTimeout(() => {
      setIsConnecting(false);
      setIsJoining(false);
    }, 15000);
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

    setCurrentDialogue('');
    currentDialogueRef.current = '';
    setStickmanMood('neutral');

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

  // ── 4. Submit Secret Word (Chooser / Word Setter) ─────────────────────────
  const handleSetWord = async (customWord = secretWordInput, customClue = null) => {
    // Sanitize Again: extract input and clean with .trim().toLowerCase()
    const finalWord = (customWord || secretWordInput || '').trim().toLowerCase();

    // Set isVerifying(true) and clear any previous errors setError(null) at the start
    setIsVerifying(true);
    setError(null);

    // State Management: Wrap the logic in a try/catch/finally block
    try {
      if (!finalWord || !/^[a-z]+$/.test(finalWord) || finalWord.length < 2) {
        throw new Error("Word must be at least 2 letters and contain only letters.");
      }

      // Fast-path 1: Clue passed directly (e.g., from word suggestions card click)
      let clue = (typeof customClue === 'string' && customClue.trim()) ? customClue.trim() : null;

      // Fast-path 2: Use live preview definition if already loaded for this word
      if (!clue && liveWordDef?.found && liveWordDef?.word?.toLowerCase() === finalWord && liveWordDef?.definition) {
        clue = liveWordDef.definition;
      }

      // Fast-path 3: Check local curated dictionary meaning (0ms)
      if (!clue) {
        clue = getWordMeaning(finalWord);
      }

      // Fast-path 4: Validate and fetch clue (via fast cached / api route / 275k words)
      if (!clue) {
        clue = await validateAndFetchClue(finalWord);
      }

      // The Check: if (!clue) { throw new Error("Invalid word"); }
      if (!clue) {
        throw new Error("Invalid word");
      }

      // If it passes, emit the sanitized word
      const socket = socketRef.current || getSocket();
      if (socket) {
        socket.emit("set_secret_word", { word: finalWord, clue });
        socket.emit("set_word", { word: finalWord, clue, meaning: clue });
      }
      setSetterWordSubmitted(true);
    } catch (err) {
      // Error Catching: In the catch block, set the error state
      setError(err?.message && err.message !== "Invalid word" ? err.message : "Invalid word. Please enter a real English word.");
    } finally {
      // Cleanup: In the finally block, ensure isVerifying(false) is called
      setIsVerifying(false);
    }
  };

  const handleSubmitWord = handleSetWord;

  // ── 5. Guess Letter (Guesser) ─────────────────────────────────────────────
  const handleGuessLetter = (letter) => {
    // Satisfying mechanical keyboard switch click sound on every press
    playMechanicalClick();

    if (gameState !== 'guessing' || !game) return;
    const l = letter.toUpperCase();
    if (game.guessedLetters.includes(l)) return;

    // Check if guess is correct (PvE mode has secret word locally)
    const isCorrect = game.word ? game.word.toUpperCase().includes(l) : false;
    recordGuessStats(isCorrect);

    if (isCorrect) {
      triggerHappyGuess();
    } else {
      const nextWrongCount = (game.wrongGuesses?.length || 0) + 1;
      triggerMeanWrongGuess(nextWrongCount);
    }

    if (isPveMode) {
      const currentRoom = { state: gameState, players, game };
      const nextRoom = processGuess(currentRoom, l);
      if (nextRoom.state === 'roundover') {
        const won = nextRoom.game.roundResult === 'guesser_wins';
        recordDuelEndStats(won);
        // Freeze the random dialogue exactly once when the round ends
        const mistakes = nextRoom.game.wrongGuesses?.length ?? 0;
        const dialogue = getRandomPerformanceDialogue(mistakes, won);
        setFrozenDialogue(dialogue);

        if (won) {
          setPveScore(s => ({ ...s, human: s.human + 1 }));
        } else {
          setPveScore(s => ({ ...s, bot: s.bot + 1 }));
        }
      }
      applyState(nextRoom);
      return;
    }

    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('guess_letter', { letter: l });
    }
  };

  // ── 6. Next Round & Skip Countdown ────────────────────────────────────────
  const handleNextRound = useCallback(() => {
    if (isPveMode) {
      const nextRound = pveRound + 1;
      setPveRound(nextRound);
      startPveGame(pveDifficulty, nextRound, null, pveMaxRounds);
      return;
    }

    setIsWaitingOpponent(true);
    const socket = socketRef.current || getSocket();
    if (socket) {
      socket.emit('next_round');
    }
    if (roomCode) {
      fetch('/api/room/next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode }),
      }).catch(() => {});
    }
  }, [isPveMode, pveRound, pveDifficulty, pveMaxRounds, startPveGame, roomCode]);

  // Instant Skip for the 10-second Countdown
  const handleSkipCountdown = useCallback(() => {
    if (pveCountdownRef.current) {
      clearInterval(pveCountdownRef.current);
      pveCountdownRef.current = null;
    }
    setPveCountdown(null);
    const nextRound = pveRound + 1;
    setPveRound(nextRound);
    startPveGame(pveDifficulty, nextRound, pveScore, pveMaxRounds);
  }, [pveRound, pveDifficulty, pveScore, pveMaxRounds, startPveGame]);

  // ── Enter Key Listener for Instant Next Round ─────────────────────────────
  useEffect(() => {
    if (!isRoundOverModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (isPveMode) {
          handleSkipCountdown();
        } else {
          handleNextRound();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoundOverModalOpen, isPveMode, handleSkipCountdown, handleNextRound]);

  // ── PvE Auto-Continue Countdown (10 seconds for comfortable reading) ──────
  const pveCountdownRef = useRef(null);
  useEffect(() => {
    // Only run when modal is open in PvE mode, not the final round
    if (!isRoundOverModalOpen || !isPveMode || pveRound >= pveMaxRounds) {
      if (pveCountdownRef.current) clearInterval(pveCountdownRef.current);
      setPveCountdown(null);
      return;
    }

    let count = 10;
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
    const socket = socketRef.current || getSocket();
    if (socket && typeof socket.emit === 'function') {
      socket.emit('leave_room');
    }
    setDisconnectNotice(null);
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
    const socket = socketRef.current || getSocket();
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
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(roomCode);
      }
      showToast(`Room code "${roomCode}" copied to clipboard! 📋`);
    }
  };

  // Copy Shareable Link Helper
  const copyInviteLink = () => {
    if (!roomCode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?join=${encodeURIComponent(roomCode)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl);
    }
    showToast('🔗 Invite link copied! Send it to your friend 🚀', 3000);
  };

  // Share via WhatsApp Helper
  const shareViaWhatsApp = () => {
    if (!roomCode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/?join=${encodeURIComponent(roomCode)}`;
    const text = `🎮 Play Hangman Duel with me! Click the link to join my room: ${inviteUrl} (Room Code: ${roomCode})`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Derived Values
  const livesLeft = game ? game.livesLeft : MAX_LIVES;
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const hiddenWordChars = (() => {
    const hw = game?.hiddenWord;
    if (hw) {
      if (Array.isArray(hw)) return hw;
      const str = String(hw).trim();
      if (str.includes(' ')) {
        return str.split(/\s+/).filter(Boolean);
      }
      return str.split('');
    }
    if (game?.word) {
      const guessedSet = new Set((game?.guessedLetters || []).map(l => l.toUpperCase()));
      return game.word.toUpperCase().split('').map(ch => (guessedSet.has(ch) ? ch : '_'));
    }
    return [];
  })();

  // ── Physical Keyboard Support for Guesser ─────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an active input field or modal
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // Only allow guessing during active guessing phase
      if (gameState !== 'guessing' || !game || isRoundOverModalOpen || showPveModal) {
        return;
      }

      // For multiplayer: Only the guesser can guess (setter is watching)
      if (!isPveMode && isWordSetter) {
        return;
      }

      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Validate single alphabetical character
      if (/^[a-zA-Z]$/.test(e.key)) {
        const key = e.key.toUpperCase();
        handleGuessLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, game, myPlayerId, isPveMode, isWordSetter, isRoundOverModalOpen, showPveModal, handleGuessLetter]);

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

  // ── Stop Any Dialogue Speech When Round Finishes / Modal Opens ───────────
  useEffect(() => {
    if (isRoundOverModalOpen) {
      stopDialogue();
    }
  }, [isRoundOverModalOpen]);

  // ── Continuous 60fps Physics & Idle Animation Loop (Active during Gameplay) ──
  useEffect(() => {
    if (screen !== 'game' || (gameState !== 'guessing' && gameState !== 'roundover')) return;

    let animId = null;
    const startTime = performance.now();

    const loop = (now) => {
      const elapsed = now - startTime;
      const wrongCount = Array.isArray(game?.wrongGuesses)
        ? game.wrongGuesses.length
        : Math.max(0, (game?.maxLives || MAX_LIVES) - (livesLeft ?? MAX_LIVES));
      const mistakes = Math.min(Math.max(0, wrongCount), 10);
      const isDead = (livesLeft !== undefined && livesLeft <= 0) || mistakes >= 10;

      // Only draw continuous idle if not currently running the special death/escape cutscene
      if (!specialAnimIdRef.current) {
        if (hangmanCanvasRef.current) {
          drawFrame(hangmanCanvasRef.current, mistakes, isDead, elapsed);
        }
        if (hangmanWatchCanvasRef.current) {
          drawFrame(hangmanWatchCanvasRef.current, mistakes, isDead, elapsed);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [screen, gameState, livesLeft, stickmanMood, game?.maxLives, drawFrame]);

  // Guessed set & collections
  const guessedSet = new Set((game?.guessedLetters || []).map(l => l.toUpperCase()));
  const wrongSet = new Set((game?.wrongGuesses || []).map(l => l.toUpperCase()));
  const newGuessedSet = new Set(newlyGuessedLetters.map(l => l.toUpperCase()));
  const newWrongSet = new Set(newlyWrongLetters.map(l => l.toUpperCase()));
  const cleanWord = (game?.word || '').toUpperCase();

  // ── Word Definition Lookup for Round Over Modal ────────────────────────────
  const [wordMeaning, setWordMeaning] = useState('');
  const [isFetchingMeaning, setIsFetchingMeaning] = useState(false);

  useEffect(() => {
    if (!isRoundOverModalOpen || !cleanWord) {
      setWordMeaning('');
      setIsFetchingMeaning(false);
      return;
    }

    // 1. Check local curated dictionary or game state first
    const directMeaning = (game?.meaning) || getWordMeaning(cleanWord);
    if (directMeaning && directMeaning.trim()) {
      setWordMeaning(directMeaning.trim());
      setIsFetchingMeaning(false);
      return;
    }

    // 2. Check localStorage cache
    const cacheKey = `hangman_def_${cleanWord.toLowerCase()}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setWordMeaning(cached);
        setIsFetchingMeaning(false);
        return;
      }
    } catch {}

    // 3. Fallback: Fetch from Dictionary API asynchronously
    let isMounted = true;
    setIsFetchingMeaning(true);

    const fetchMeaning = async () => {
      try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`);
        if (!res.ok) throw new Error('Definition not found');
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.meanings?.length) {
          const firstDef = data[0].meanings[0]?.definitions?.[0]?.definition || '';
          const partOfSpeech = data[0].meanings[0]?.partOfSpeech ? `(${data[0].meanings[0].partOfSpeech}) ` : '';
          const fullDef = partOfSpeech ? `${partOfSpeech}${firstDef}` : firstDef;
          if (fullDef && isMounted) {
            setWordMeaning(fullDef);
            try { localStorage.setItem(cacheKey, fullDef); } catch {}
          }
        }
      } catch {
        if (isMounted) {
          setWordMeaning('A valid English dictionary word.');
        }
      } finally {
        if (isMounted) {
          setIsFetchingMeaning(false);
        }
      }
    };

    fetchMeaning();

    return () => {
      isMounted = false;
    };
  }, [isRoundOverModalOpen, cleanWord, game?.meaning]);

  const activeHint = game?.hint || game?.meaning || wordMeaning || (cleanWord ? getWordMeaning(cleanWord) : '') || '';
  const clue = activeHint;
  const isHardDifficulty = (isPveMode && pveDifficulty === 'hard') || (game?.difficulty === 'hard');

  return (
    <>
      {/* ─── LOBBY / LANDING PAGE SCREEN ─────────────────────────────────── */}
      <div id="screen-lobby" className={`screen ${screen === 'lobby' ? 'active' : ''} text-slate-100 font-sans selection:bg-purple-500 selection:text-white`}>
        
        {/* ─── Typography & Display Font Injection ──────────────────────── */}
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&family=Silkscreen:wght@400;700&family=VT323&family=Chakra+Petch:wght@500;700;800;900&family=JetBrains+Mono:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');
          
          .font-pixel {
            font-family: 'Pixelify Sans', 'Silkscreen', 'VT323', monospace;
            letter-spacing: 0.01em;
          }
          .font-display {
            font-family: 'Chakra Petch', 'Orbitron', 'JetBrains Mono', -apple-system, sans-serif;
            letter-spacing: -0.02em;
          }
          .font-mono-code {
            font-family: 'JetBrains Mono', monospace;
          }
        `}</style>

        {/* ─── Ambient Glows & Grid Pattern ─────────────────────────────── */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-violet-600/25 via-purple-600/10 to-transparent blur-[130px] rounded-full" />
          <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 blur-[140px] rounded-full" />
          <div className="absolute bottom-[15%] left-[-5%] w-[450px] h-[450px] bg-emerald-500/10 blur-[130px] rounded-full" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_70%,transparent_100%)]" />
        </div>

        {/* ─── 1. NAVBAR (Only rendered on the Landing/Lobby Screen) ──── */}
        <Navbar
          onPlayNow={() => {
            const el = document.getElementById('input-name');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
            }
          }}
        />

        {/* ─── 2. HERO SECTION ────────────────────────────────────────── */}
        <section id="hero" className="relative z-10 pt-12 pb-20 md:pt-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto mb-14">
            
            {/* Top Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/25 backdrop-blur-sm text-yellow-400 text-xs font-mono-code font-bold tracking-widest uppercase mb-6 shadow-sm shadow-yellow-500/10">
              <span>⚡ MULTIPLAYER WORD DUEL</span>
            </div>

            {/* Headline in Subtle Pixel Font */}
            <h1 className="font-pixel text-2xl sm:text-4xl md:text-[44px] lg:text-[48px] font-semibold text-white tracking-normal leading-[1.28] mb-5">
              <span className="block">Guess the word.</span>
              <span className="block mt-1 sm:mt-1.5">Save the stickman.</span>
              <span className="block mt-1 sm:mt-1.5">Win the duel.</span>
            </h1>

            {/* Subheadline */}
            <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              Challenge a friend in real time, outsmart the AI in solo mode, or create a room and duel anyone with the code. Every wrong guess brings the noose closer.
            </p>
          </div>

          {/* Hero Content: Side-by-Side Launcher Card & Live Game Graphic */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
            
            {/* Left Col: Interactive Duel Launcher & Room Creator */}
            <div id="lobby-launcher" className="lg:col-span-6 w-full flex flex-col">
              <div className="relative bg-[#11101d]/90 border border-white/15 shadow-2xl rounded-3xl p-6 sm:p-8 backdrop-blur-xl w-full flex-1 flex flex-col justify-between transition-all duration-300">
                
                <div>
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-7">
                        <line x1="10" y1="115" x2="90" y2="115" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <line x1="30" y1="115" x2="30" y2="10" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <line x1="30" y1="10" x2="65" y2="10" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <line x1="65" y1="10" x2="65" y2="25" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                        <circle cx="65" cy="35" r="10" stroke="currentColor" strokeWidth="5" />
                        <line x1="65" y1="45" x2="65" y2="75" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold font-display uppercase tracking-wider text-white">
                        Start a Match
                      </h2>
                      <p className="text-xs text-slate-400">
                        Create a private room or enter a code to duel
                      </p>
                    </div>
                  </div>

                  <div className="lobby-form flex flex-col">
                    {/* 1. Global Input: Your Name (Always Visible) */}
                    <div className="input-group flex flex-col gap-1.5 mb-4">
                      <label htmlFor="input-name" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Your Name
                      </label>
                      <input
                        id="input-name"
                        type="text"
                        placeholder="Enter your name…"
                        maxLength={20}
                        autoComplete="off"
                        className={`w-full px-4 py-3 bg-slate-950/70 border ${lobbyError ? 'border-red-500/80 focus:border-red-400 focus:ring-2 focus:ring-red-500/30' : 'border-white/15 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30'} rounded-2xl text-white placeholder-slate-400 backdrop-blur-md outline-none transition-all text-sm`}
                        value={playerName}
                        onChange={(e) => handlePlayerNameChange(e.target.value)}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') {
                            if (activeMode === 'pve') {
                              startPveGame(pveDifficulty, 1, { human: 0, bot: 0 }, pveMaxRounds);
                            } else {
                              handleCreateRoom();
                            }
                          } 
                        }}
                      />

                      {/* ── High-Visibility Error Block for Duplicate Name / Validation Errors ── */}
                      {lobbyError && (
                        <div
                          id="duplicate-name-error"
                          className="mt-2 p-3 rounded-xl bg-red-950/90 border border-red-500/70 text-red-200 text-xs font-semibold flex items-center gap-2.5 shadow-lg shadow-red-950/50 animate-shake"
                          role="alert"
                        >
                          <span className="text-base flex-shrink-0">⚠️</span>
                          <div className="flex-1">
                            <p className="leading-snug">{lobbyError}</p>
                            <span className="text-[11px] text-red-300/80 font-normal">
                              Usernames must be unique within the room. Please choose another name.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. The Segmented Tab Controller (The UI Switcher) */}
                    <div className="flex p-1 space-x-1 bg-[#0a0a0f] border border-white/10 rounded-xl mb-6 select-none">
                      <button
                        type="button"
                        id="tab-1v1"
                        onClick={() => {
                          playMechanicalClick();
                          setActiveMode('1v1');
                          setLobbyError('');
                        }}
                        className={`w-full rounded-lg py-2.5 text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeMode === '1v1'
                            ? 'bg-white/10 text-white shadow-sm font-medium'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>⚔️</span>
                        <span>1v1 Duel</span>
                      </button>

                      <button
                        type="button"
                        id="tab-team"
                        onClick={() => {
                          playMechanicalClick();
                          setActiveMode('team');
                          setLobbyError('');
                        }}
                        className={`w-full rounded-lg py-2.5 text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeMode === 'team'
                            ? 'bg-white/10 text-white shadow-sm font-medium'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>🛡️</span>
                        <span>Team Mode</span>
                      </button>

                      <button
                        type="button"
                        id="tab-pve"
                        onClick={() => {
                          playMechanicalClick();
                          setActiveMode('pve');
                          setLobbyError('');
                        }}
                        className={`w-full rounded-lg py-2.5 text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                          activeMode === 'pve'
                            ? 'bg-white/10 text-white shadow-sm font-medium'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>🤖</span>
                        <span>Solo PvE</span>
                      </button>
                    </div>

                    {/* 3. Conditional Mode Blocks */}

                    {/* ─── A. 1V1 DUEL MODE BLOCK ────────────────────────────────── */}
                    {activeMode === '1v1' && (
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        {/* Standard Purple Create Room Button */}
                        <div className="create-section flex flex-col gap-2">
                          <button
                            id="btn-create"
                            className={`btn btn-primary w-full py-3.5 px-6 rounded-2xl font-bold font-display uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-lg shadow-purple-600/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-500/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${isConnecting ? 'loading' : ''}`}
                            disabled={isConnecting}
                            onClick={handleCreateRoom}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            {isConnecting ? 'Creating Room… 🎮' : 'Create Room (Host)'}
                          </button>

                          {/* Host Settings Accordion */}
                          <div className="host-settings-toggle">
                            <button
                              id="btn-advanced"
                              className="btn-advanced-toggle text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                              aria-expanded={advancedOpen}
                              onClick={() => setAdvancedOpen(!advancedOpen)}
                              type="button"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                              </svg>
                              Advanced Host Settings
                              <svg className="chevron w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </div>

                          <div id="host-settings" className={`host-settings ${advancedOpen ? 'expanded' : 'collapsed'}`}>
                            <div className="host-settings-inner">
                              <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <label htmlFor="select-timer" className="setting-label text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  Word Pick Time Limit
                                </label>
                                <div className="w-full sm:w-52">
                                  <CustomDropdown
                                    id="select-timer"
                                    value={wordPickTime}
                                    onChange={(val) => setWordPickTime(Number(val))}
                                  />
                                </div>
                              </div>
                              <p className="setting-hint text-xs">If the Word Setter doesn't pick in time, a random word is chosen automatically.</p>
                            </div>
                          </div>
                        </div>

                        <div className="divider"><span>or join with code</span></div>

                        {/* Team Selection for Join (1v1) */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Choose Team to Join</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              id="btn-join-team-a"
                              className={`p-2.5 rounded-xl border transition-all text-left flex flex-col gap-0.5 cursor-pointer backdrop-blur-md ${
                                selectedTeam === 'teamA'
                                  ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)] text-white ring-1 ring-cyan-400/50'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                              onClick={() => { playMechanicalClick(); setSelectedTeam('teamA'); }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs flex items-center gap-1 text-cyan-300">🛡️ Team A</span>
                                {selectedTeam === 'teamA' && <span className="text-[8px] font-mono font-black bg-cyan-400/20 text-cyan-300 px-1 py-0.5 rounded border border-cyan-400/40">✓</span>}
                              </div>
                              <span className="text-[10px] text-slate-500">Word Setters</span>
                            </button>
                            <button
                              type="button"
                              id="btn-join-team-b"
                              className={`p-2.5 rounded-xl border transition-all text-left flex flex-col gap-0.5 cursor-pointer backdrop-blur-md ${
                                selectedTeam === 'teamB'
                                  ? 'bg-purple-500/20 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.35)] text-white ring-1 ring-purple-400/50'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                              onClick={() => { playMechanicalClick(); setSelectedTeam('teamB'); }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs flex items-center gap-1 text-purple-300">⚔️ Team B</span>
                                {selectedTeam === 'teamB' && <span className="text-[8px] font-mono font-black bg-purple-400/20 text-purple-300 px-1 py-0.5 rounded border border-purple-400/40">✓</span>}
                              </div>
                              <span className="text-[10px] text-slate-500">Challengers</span>
                            </button>
                          </div>
                        </div>

                        {/* Standard 1v1 Join Code Row */}
                        <div className="join-row flex gap-2">
                          <input
                            id="input-room-code"
                            type="text"
                            placeholder="Room Code"
                            maxLength={6}
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck="false"
                            autoComplete="off"
                            className="flex-1 px-4 py-3 bg-slate-950/70 border border-white/15 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30 rounded-2xl text-white font-mono uppercase tracking-widest placeholder-slate-400 backdrop-blur-md outline-none transition-all text-sm"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
                          />
                          <button 
                            id="btn-join" 
                            className="btn btn-primary py-3 px-6 rounded-2xl font-semibold text-white tracking-wide bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-purple-500/20 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-50 text-sm" 
                            disabled={isConnecting || isJoining}
                            onClick={handleJoinRoom}
                          >
                            {isConnecting || isJoining ? 'Joining… 🎯' : `Join ${selectedTeam === 'teamA' ? 'Team A' : 'Team B'}`}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─── B. TEAM MODE BLOCK (UP TO 4V4) ────────────────────────── */}
                    {activeMode === 'team' && (
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        {/* Distinct Create Team Room Button */}
                        <div className="create-section flex flex-col gap-2">
                          <button
                            id="btn-create-team"
                            className={`btn w-full py-3.5 px-6 rounded-2xl font-bold font-display uppercase tracking-wider text-white bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 shadow-lg shadow-cyan-600/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-500/50 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${isConnecting ? 'loading' : ''}`}
                            disabled={isConnecting}
                            onClick={handleCreateRoom}
                          >
                            <Users className="w-5 h-5" />
                            {isConnecting ? 'Creating Team Room… 🛡️' : 'Create Team Room (Host)'}
                          </button>

                          {/* Host Settings Accordion */}
                          <div className="host-settings-toggle">
                            <button
                              id="btn-advanced-team"
                              className="btn-advanced-toggle text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                              aria-expanded={advancedOpen}
                              onClick={() => setAdvancedOpen(!advancedOpen)}
                              type="button"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                              </svg>
                              Advanced Team Settings
                              <svg className="chevron w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          </div>

                          <div id="host-settings-team" className={`host-settings ${advancedOpen ? 'expanded' : 'collapsed'}`}>
                            <div className="host-settings-inner">
                              <div className="setting-row flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <label htmlFor="select-timer-team" className="setting-label text-xs">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  Word Pick Time Limit
                                </label>
                                <div className="w-full sm:w-52">
                                  <CustomDropdown
                                    id="select-timer-team"
                                    value={wordPickTime}
                                    onChange={(val) => setWordPickTime(Number(val))}
                                  />
                                </div>
                              </div>
                              <p className="setting-hint text-xs">If the Word Setter doesn't pick in time, a random word is chosen automatically.</p>
                            </div>
                          </div>
                        </div>

                        {/* Select Your Squad Toggle Boxes */}
                        <div className="team-selection-box flex flex-col gap-1.5 my-1">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            Select Your Squad (Max 4 per Team)
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            {/* Team A Button */}
                            <button
                              type="button"
                              id="btn-team-a"
                              className={`p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 cursor-pointer backdrop-blur-md ${
                                selectedTeam === 'teamA'
                                  ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] text-white ring-1 ring-cyan-400/50'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                              onClick={() => {
                                playMechanicalClick();
                                setSelectedTeam('teamA');
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-cyan-300">
                                  <span>🛡️</span> {teamNameA || 'TEAM A'}
                                </span>
                                {selectedTeam === 'teamA' && (
                                  <span className="text-[9px] font-mono font-black bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-400/40">
                                    SELECTED
                                  </span>
                                )}
                              </div>
                              <span className="text-[10.5px] text-slate-400">Word Setters (Max 4)</span>
                            </button>

                            {/* Team B Button */}
                            <button
                              type="button"
                              id="btn-team-b"
                              className={`p-3 rounded-2xl border transition-all text-left flex flex-col gap-1 cursor-pointer backdrop-blur-md ${
                                selectedTeam === 'teamB'
                                  ? 'bg-purple-500/20 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] text-white ring-1 ring-purple-400/50'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                              onClick={() => {
                                playMechanicalClick();
                                setSelectedTeam('teamB');
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-purple-300">
                                  <span>⚔️</span> {teamNameB || 'TEAM B'}
                                </span>
                                {selectedTeam === 'teamB' && (
                                  <span className="text-[9px] font-mono font-black bg-purple-400/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/40">
                                    SELECTED
                                  </span>
                                )}
                              </div>
                              <span className="text-[10.5px] text-slate-400">Challengers (Max 4)</span>
                            </button>
                          </div>
                        </div>

                        <div className="divider"><span>or join team with code</span></div>

                        {/* Join Team Room Code Row */}
                        <div className="join-row flex gap-2">
                          <input
                            id="input-room-code"
                            type="text"
                            placeholder="Room Code"
                            maxLength={6}
                            autoCapitalize="characters"
                            autoCorrect="off"
                            spellCheck="false"
                            autoComplete="off"
                            className="flex-1 px-4 py-3 bg-slate-950/70 border border-white/15 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 rounded-2xl text-white font-mono uppercase tracking-widest placeholder-slate-400 backdrop-blur-md outline-none transition-all text-sm"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.replace(/\s+/g, '').toUpperCase())}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinRoom(); }}
                          />
                          <button 
                            id="btn-join" 
                            className="btn btn-secondary py-3 px-6 rounded-2xl font-semibold text-white tracking-wide bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] active:scale-95 flex items-center justify-center cursor-pointer disabled:opacity-50 text-sm" 
                            disabled={isConnecting || isJoining}
                            onClick={handleJoinRoom}
                          >
                            {isConnecting || isJoining ? 'Joining… 🎯' : `Join ${selectedTeam === 'teamA' ? (teamNameA || 'Team A') : (teamNameB || 'Team B')}`}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ─── C. SOLO PVE MODE BLOCK ────────────────────────────────── */}
                    {activeMode === 'pve' && (
                      <div className="flex flex-col gap-4 animate-fadeIn">
                        {/* Difficulty Selector */}
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="select-pve-difficulty" className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            AI Difficulty Level
                          </label>
                          <CustomDropdown
                            id="select-pve-difficulty"
                            value={pveDifficulty}
                            onChange={(val) => setPveDifficulty(val)}
                            options={[
                              { value: 'easy', label: '🟢 Easy (Common Words & Clues)' },
                              { value: 'medium', label: '🟡 Medium (Standard Vocabulary)' },
                              { value: 'hard', label: '🔴 Hard (Complex & Rare Words)' },
                              { value: 'nightmare', label: '💀 Nightmare (4 Lives, No Clues)' },
                            ]}
                          />
                        </div>

                        {/* Play vs Computer Button */}
                        <button
                          id="btn-pve"
                          type="button"
                          onClick={() => {
                            playMechanicalClick();
                            const name = playerName.trim();
                            if (!name) {
                              setLobbyError('Please enter your name first.');
                              showToast('Please enter your name first! ✏️');
                              return;
                            }
                            setLobbyError('');
                            startPveGame(pveDifficulty, 1, { human: 0, bot: 0 }, pveMaxRounds);
                          }}
                          className="btn btn-pve w-full py-3.5 px-6 rounded-2xl font-bold font-display uppercase tracking-wider text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-lg shadow-emerald-600/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-emerald-500/50 active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer"
                        >
                          <span className="text-xl">🤖</span>
                          <span>Play vs Computer</span>
                        </button>

                        <div className="flex items-center justify-between px-1 pt-1 text-[11px] text-slate-400">
                          <span>Match Length: {pveMaxRounds} Rounds</span>
                          <button
                            type="button"
                            onClick={() => {
                              playMechanicalClick();
                              setShowPveModal(true);
                            }}
                            className="text-purple-300 hover:text-purple-200 transition-colors font-semibold cursor-pointer"
                          >
                            Configure Match ⚙️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Dynamic Interactive Hangman Preview Card */}
            <div className="lg:col-span-6 w-full flex flex-col">
              <InteractiveHeroCard
                onPlayNow={() => {
                  const el = document.getElementById('input-name');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                  }
                }}
              />
            </div>

          </div>
        </section>

        {/* ─── 3. STATS BAR (Real-Time Live Data) ─────────────────────── */}
        <section className="relative z-10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            
            {/* Stat 1: Duels Played */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-cyan-500/30 transition-all duration-300">
              <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)] mb-1">
                {(liveStats.duelsPlayed || 0).toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
                Duels Played
              </div>
            </div>

            {/* Stat 2: Active Players */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-purple-500/30 transition-all duration-300">
              <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)] mb-1 flex items-center gap-2">
                <span>{(liveStats.activePlayers || 1).toLocaleString()}</span>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" title="Live Online" />
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
                Active Players Online
              </div>
            </div>

            {/* Stat 3: Accuracy / Win Rate */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-emerald-500/30 transition-all duration-300">
              <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] mb-1">
                {liveStats.winRate ?? 0}%
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
                Win Rate Accuracy
              </div>
            </div>

            {/* Stat 4: Words Solved */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-yellow-500/30 transition-all duration-300">
              <div className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)] mb-1">
                {(liveStats.wordsGuessed || 0).toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wider">
                Words Solved
              </div>
            </div>

          </div>
        </section>

        {/* ─── 4. FEATURES GRID ("WHY DUEL HERE") ──────────────────────── */}
        <section id="features" className="relative z-10 py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20 md:scroll-mt-24">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="font-mono-code text-xs font-bold uppercase tracking-widest text-yellow-400 mb-3">
              WHY DUEL HERE
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight">
              Engineered for players who love a duel
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              Every feature is fine-tuned for lightning speed, zero lag, and competitive tension.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* ─── Featured Highlight: Team Battles (2-Column Span) ─────── */}
            <div className="md:col-span-2 lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-[#13131a] border border-blue-500/30 hover:border-blue-500/60 hover:bg-white/5 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between">
              {/* Ambient Radial Accent Glow */}
              <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/15 rounded-full filter blur-3xl pointer-events-none group-hover:bg-blue-500/25 transition-all" />

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    FEATURED MODE
                  </span>
                </div>

                <h3 className="font-display text-xl sm:text-2xl font-bold uppercase text-white mb-3 tracking-wide flex items-center gap-2">
                  TEAM BATTLES (UP TO 4V4)
                </h3>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                  Form squads, elect a team captain, set a custom team name, and collaborate in real-time to outsmart the opposition.
                </p>
              </div>

              {/* Feature Highlights Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-6 mt-4 border-t border-white/5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/10 text-cyan-300">
                  <span>👑</span> Team Captains
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/10 text-purple-300">
                  <span>🛡️</span> 100+ Team Names
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-white/[0.04] border border-white/10 text-blue-300">
                  <span>⚔️</span> Asymmetric Squads (1v2, 2v2, 4v4)
                </span>
              </div>
            </div>

            {/* 1. Real-Time Duels */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-violet-500/40 hover:bg-white/5 transition-all duration-300 group">
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

            {/* 2. PvE Mode */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-cyan-500/40 hover:bg-white/5 transition-all duration-300 group">
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

            {/* 3. Room Codes & Links */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-emerald-500/40 hover:bg-white/5 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-bold uppercase text-white mb-2 tracking-wide">
                Room Codes & Links
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generate private room codes and instant shareable invite links. Challenge friends with a single click across WhatsApp, Discord, or web.
              </p>
            </div>

            {/* 4. Fast Rounds */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-yellow-500/40 hover:bg-white/5 transition-all duration-300 group">
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

            {/* 5. Live Leaderboard */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-fuchsia-500/40 hover:bg-white/5 transition-all duration-300 group">
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

            {/* 6. Advanced Settings */}
            <div className="p-6 rounded-2xl bg-[#13131a] border border-white/5 hover:border-rose-500/40 hover:bg-white/5 transition-all duration-300 group">
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
        <section id="how-to-play" className="relative z-10 py-20 md:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-white/5 scroll-mt-20 md:scroll-mt-24">
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

            <div className="relative p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
              <div className="font-mono-code text-5xl font-black text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]">
                02
              </div>
              <h3 className="font-display text-2xl font-bold uppercase text-white mb-3 tracking-wide">
                Create or join
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Spin up a room to get a code or sharable invite link, send it to your friend, or enter an existing code to challenge a host.
              </p>
            </div>

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
                onClick={() => {
                  const el = document.getElementById('input-name');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                  }
                }}
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
                    <div className="flex items-center justify-center gap-2.5 sm:gap-3 font-mono-code">
                      {showcaseRevealed.map((char, index) => (
                        <div
                          key={index}
                          className={`w-10 h-13 sm:w-12 sm:h-15 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-bold border ${
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

                  {/* Lives Tracker */}
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

                  {/* Interactive Virtual Keyboard */}
                  <div className="space-y-2">
                    <div className="text-xs font-mono-code text-slate-400 mb-2">
                      Interactive Virtual Keyboard (Try clicking!):
                    </div>

                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((key) => {
                        const state = showcaseGuessed[key];
                        return (
                          <button
                            key={key}
                            onClick={() => handleShowcaseKeyClick(key)}
                            type="button"
                            className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
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

                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((key) => {
                        const state = showcaseGuessed[key];
                        return (
                          <button
                            key={key}
                            onClick={() => handleShowcaseKeyClick(key)}
                            type="button"
                            className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
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

                    <div className="flex justify-center gap-1 sm:gap-1.5">
                      {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((key) => {
                        const state = showcaseGuessed[key];
                        return (
                          <button
                            key={key}
                            onClick={() => handleShowcaseKeyClick(key)}
                            type="button"
                            className={`w-7 h-9 sm:w-8 sm:h-10 rounded-lg font-mono-code font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer ${
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
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/15 via-fuchsia-600/15 to-cyan-600/15 blur-3xl rounded-3xl -z-10" />

          <div className="p-10 sm:p-16 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/30 mx-auto flex items-center justify-center text-yellow-400 mb-6 shadow-sm shadow-yellow-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-extrabold uppercase text-white tracking-tight leading-tight mb-4">
              Your stickman is waiting.
            </h2>

            <p className="max-w-xl mx-auto text-slate-400 text-base sm:text-lg mb-8">
              Jump into a live match right now. No downloads, no registration required.
            </p>

            <button
              onClick={() => {
                const el = document.getElementById('input-name');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.focus();
                }
              }}
              className="px-10 py-5 rounded-xl font-display font-bold text-lg uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-purple-600/40 hover:shadow-purple-500/60 hover:scale-[1.04] active:scale-[0.98] transition-all duration-200 inline-flex items-center gap-3 cursor-pointer"
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

      {/* ─── WAITING SCREEN ───────────────────────────────────────────────── */}
      <div id="screen-waiting" className={`screen ${screen === 'waiting' ? 'active' : ''}`}>
        {/* Dynamic Animated Aurora Background Blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/25 rounded-full filter blur-3xl opacity-70 animate-blob mix-blend-screen" />
          <div className="absolute top-1/4 -right-20 w-96 h-96 bg-purple-600/30 rounded-full filter blur-3xl opacity-75 animate-blob [animation-delay:2s] mix-blend-screen" />
          <div className="absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] bg-pink-500/20 rounded-full filter blur-3xl opacity-60 animate-blob [animation-delay:4s] mix-blend-screen" />
        </div>

        <WaitingRoomUI
          roomCode={roomCode}
          teamA={teamA}
          teamB={teamB}
          teamNameA={teamNameA}
          teamNameB={teamNameB}
          leaderA={leaderA}
          leaderB={leaderB}
          currentSocketId={currentSocketId}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onToggleReady={handleToggleReady}
          onSetTeamName={handleSetTeamName}
          onAssignLeader={handleAssignLeader}
          onLeaveRoom={handleLeaveGame}
          copyRoomCode={copyRoomCode}
          copyInviteLink={copyInviteLink}
          shareViaWhatsApp={shareViaWhatsApp}
          liveTriviaFact={liveTriviaFact}
          isFactFading={isFactFading}
          suggestedNames={suggestedNames}
          onRerollNames={shuffleSuggestedNames}
        />
      </div>

      {/* ─── ACTIVE GAME ARENA ────────────────────────────────────────────── */}
      <div
        id="screen-game"
        className={`screen ${screen === 'game' ? 'active' : ''} ${isScreenFlashing ? 'game-losing-flash' : ''}`}
      >
        {/* Dynamic Animated Aurora Background Blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full filter blur-3xl opacity-60 animate-blob mix-blend-screen" />
          <div className="absolute top-1/3 -right-20 w-96 h-96 bg-purple-600/25 rounded-full filter blur-3xl opacity-65 animate-blob [animation-delay:2s] mix-blend-screen" />
          <div className="absolute -bottom-32 left-1/3 w-[30rem] h-[30rem] bg-pink-500/15 rounded-full filter blur-3xl opacity-50 animate-blob [animation-delay:4s] mix-blend-screen" />
        </div>

        {/* Phase Gatekeeper: If in waiting phase in multiplayer, render WaitingRoomUI */}
        {!isPveMode && roomStatus === 'waiting' ? (
          <WaitingRoomUI
            roomCode={roomCode}
            teamA={teamA}
            teamB={teamB}
            teamNameA={teamNameA}
            teamNameB={teamNameB}
            leaderA={leaderA}
            leaderB={leaderB}
            currentSocketId={currentSocketId}
            myPlayerId={myPlayerId}
            isHost={isHost}
            onToggleReady={handleToggleReady}
            onSetTeamName={handleSetTeamName}
            onAssignLeader={handleAssignLeader}
            onLeaveRoom={handleLeaveGame}
            copyRoomCode={copyRoomCode}
            copyInviteLink={copyInviteLink}
            shareViaWhatsApp={shareViaWhatsApp}
            liveTriviaFact={liveTriviaFact}
            isFactFading={isFactFading}
            suggestedNames={suggestedNames}
            onRerollNames={shuffleSuggestedNames}
          />
        ) : (
          <>
            {/* Header Bar */}
            <header className="w-full max-w-7xl mx-auto px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-3 z-10 border-b border-white/10 flex-nowrap flex-shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-400 flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 sm:w-4 sm:h-4">
                <path d="M3 21h10" /><path d="M6 21V3h10" /><path d="M6 7l4-4" /><path d="M16 3v3" />
                <circle cx="16" cy="8.5" r="2.2" /><path d="M16 10.7v4.3" />
                <path d="M13.5 13.2L16 11.8l2.5 1.4" /><path d="M14 19l2-4 2 4" />
              </svg>
            </div>
            <div className="flex items-center text-xs sm:text-sm md:text-base font-bold uppercase tracking-wider">
              <span className="text-white">Hangman</span>
              <span className="ml-1 text-purple-400">Duel</span>
            </div>
          </div>

          {/* Header Scoreboard (Aesthetic Glassmorphic Duel Badge) */}
          <div id="scoreboard" className="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-[#131124]/90 border border-purple-500/30 backdrop-blur-xl shadow-[0_0_15px_rgba(168,85,247,0.15)] flex-shrink-0 select-none" aria-live="polite">
            {/* Team A Badge */}
            <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-lg transition-all ${
              currentTurnTeam === 'teamA'
                ? 'bg-cyan-500/25 border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]'
                : 'bg-cyan-500/10 border border-cyan-400/20 opacity-80'
            }`}>
              <span className="text-[10px] sm:text-xs font-bold text-cyan-200 flex items-center gap-1">
                <span>🛡️</span> {isPveMode ? p1.name : `${(teamNameA || 'Team A').toUpperCase()} (${teamA.length || 1})`}
              </span>
              <span className="font-mono text-xs sm:text-sm font-black text-cyan-400 min-w-[16px] sm:min-w-[18px] text-center bg-cyan-950/70 px-1 py-0.5 rounded border border-cyan-500/40 drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]">
                {isPveMode ? p1.score : (teamScores.teamA ?? p1.score)}
              </span>
            </div>

            {/* Pulsing VS Divider */}
            <span className="font-mono text-[9px] sm:text-xs font-black text-purple-400/80 px-0.5 animate-pulse">VS</span>

            {/* Team B Badge */}
            <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-lg transition-all ${
              currentTurnTeam === 'teamB'
                ? 'bg-purple-500/25 border-2 border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]'
                : 'bg-purple-500/10 border border-purple-400/20 opacity-80'
            }`}>
              <span className="font-mono text-xs sm:text-sm font-black text-purple-400 min-w-[16px] sm:min-w-[18px] text-center bg-purple-950/70 px-1 py-0.5 rounded border border-purple-500/40 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]">
                {isPveMode ? p2.score : (teamScores.teamB ?? p2.score)}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-purple-200 flex items-center gap-1">
                <span>⚔️</span> {isPveMode ? p2.name : `${(teamNameB || 'Team B').toUpperCase()} (${teamB.length || 1})`}
              </span>
              {isPveMode && (
                <span className={`text-[7.5px] sm:text-[8.5px] font-mono font-black tracking-wider uppercase px-1 py-0.5 rounded border shadow-sm ${
                  pveDifficulty === 'easy'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : pveDifficulty === 'hard'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : pveDifficulty === 'nightmare'
                    ? 'bg-red-950/80 text-red-400 border-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}>
                  {pveDifficulty === 'nightmare' ? '💀 NIGHTMARE' : pveDifficulty.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Controls: Voice Toggle, Keys SFX Toggle & Leave Game CTA */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* Dialogue Voice (TTS) Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !voiceMuted;
                setVoiceMuted(next);
                setVoiceMutedState(next);
                if (!next && gameState === 'guessing' && !isWordSetter) {
                  speakDialogue("Dialogue voice active!");
                }
              }}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer backdrop-blur-md ${
                voiceMuted
                  ? 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'
                  : 'bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.25)]'
              }`}
              title={voiceMuted ? 'Dialogue Speech: MUTED (Click to Unmute)' : 'Dialogue Speech: ACTIVE (Click to Mute)'}
              aria-label="Toggle Dialogue Speech"
            >
              <span>{voiceMuted ? '🔇' : '🗣️'}</span>
              <span className="hidden md:inline">{voiceMuted ? 'Voice Off' : 'Voice On'}</span>
            </button>

            {/* Mechanical Keyboard Click Sound Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !sfxMuted;
                setSfxMuted(next);
                setSfxMutedState(next);
                if (!next) playMechanicalClick();
              }}
              className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold border transition-all flex items-center gap-1 cursor-pointer backdrop-blur-md ${
                sfxMuted
                  ? 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'
                  : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
              }`}
              title={sfxMuted ? 'Keyboard Sound: MUTED (Click to Unmute)' : 'Keyboard Click: ACTIVE (Click to Mute)'}
              aria-label="Toggle Keyboard Click Sound"
            >
              <span>⌨️</span>
              <span className="hidden md:inline">{sfxMuted ? 'Keys Off' : 'Keys On'}</span>
            </button>

            <span className="hidden lg:inline-block px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] text-slate-400">
              {isPveMode ? `BOT: ${pveDifficulty.toUpperCase()}` : `ROOM: ${roomCode}`}
            </span>
            <button
              id="btn-leave-game"
              type="button"
              onClick={handleLeaveGame}
              className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30 hover:text-rose-300 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[11px] sm:text-xs font-semibold transition-all backdrop-blur-md flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
              aria-label="Leave Game"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Leave</span>
            </button>
          </div>
        </header>

        <main className="game-main flex-1 min-h-0 w-full overflow-y-auto lg:overflow-hidden flex flex-col items-center justify-between p-1 sm:p-1.5 md:p-2">
          {/* ─── TEAM VS TEAM TWO-COLUMN ROSTER ───────────────────────────── */}
          {!isPveMode && (
            <div className="w-full max-w-7xl mx-auto px-2 py-1 flex-shrink-0">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* Team A Roster Card */}
                <div
                  className={`p-2 sm:p-2.5 rounded-xl border transition-all backdrop-blur-xl ${
                    currentTurnTeam === 'teamA'
                      ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/60'
                      : 'bg-[#121020]/60 border-white/10 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base">🛡️</span>
                      <span className={`font-display font-bold text-xs sm:text-sm tracking-wider uppercase truncate max-w-[110px] sm:max-w-[150px] ${currentTurnTeam === 'teamA' ? 'text-cyan-300' : 'text-slate-300'}`}>
                        {teamNameA || 'Team A'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({teamA.length}/4)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {currentTurnTeam === 'teamA' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-mono font-bold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                          TURN
                        </span>
                      )}
                      <span className="font-mono text-xs font-black text-cyan-400 bg-cyan-950/90 px-1.5 py-0.5 rounded border border-cyan-500/40">
                        {teamScores.teamA || 0} PTS
                      </span>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="flex flex-wrap gap-1">
                    {teamA.length > 0 ? (
                      teamA.map((p) => {
                        const isYou = p.sessionId === myPlayerId || p.id === myPlayerId || p.isYou;
                        const isLeader = p.isLeader || (p.socketId && p.socketId === leaderA);
                        return (
                          <span
                            key={p.sessionId || p.id}
                            className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-all ${
                              currentTurnTeam === 'teamA'
                                ? isYou
                                  ? 'bg-cyan-500/40 text-cyan-100 border border-cyan-300 shadow-sm'
                                  : 'bg-cyan-950/80 text-cyan-200 border border-cyan-500/40'
                                : isYou
                                ? 'bg-cyan-950/40 text-cyan-200 border border-cyan-500/20'
                                : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}
                          >
                            {isLeader && (
                              <span title="Team Leader" className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] text-xs animate-pulse">
                                👑
                              </span>
                            )}
                            {p.isHost && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono" title="Room Host">
                                HOST
                              </span>
                            )}
                            <span className="truncate max-w-[80px] sm:max-w-[120px]">{p.name}</span>
                            {isYou && <span className="text-[8.5px] text-cyan-300 font-mono font-normal">(You)</span>}
                            {!p.connected && <span className="text-[8.5px] text-rose-400" title="Disconnected">🔌</span>}
                            {isHost && !isLeader && (
                              <button
                                type="button"
                                onClick={() => handleAssignLeader(p.socketId, 'teamA')}
                                className="text-[8px] px-1 py-0.2 rounded bg-amber-400/20 hover:bg-amber-400/40 text-amber-300 border border-amber-400/30 ml-0.5 cursor-pointer transition-all active:scale-95"
                                title={`Make ${p.name} Team Leader`}
                              >
                                Make Leader
                              </button>
                            )}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">No players joined yet</span>
                    )}
                  </div>
                </div>

                {/* Team B Roster Card */}
                <div
                  className={`p-2 sm:p-2.5 rounded-xl border transition-all backdrop-blur-xl ${
                    currentTurnTeam === 'teamB'
                      ? 'bg-purple-950/70 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] ring-1 ring-purple-400/60'
                      : 'bg-[#121020]/60 border-white/10 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-white/10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base">⚔️</span>
                      <span className={`font-display font-bold text-xs sm:text-sm tracking-wider uppercase truncate max-w-[110px] sm:max-w-[150px] ${currentTurnTeam === 'teamB' ? 'text-purple-300' : 'text-slate-300'}`}>
                        {teamNameB || 'Team B'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({teamB.length}/4)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {currentTurnTeam === 'teamB' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-400/20 text-purple-300 border border-purple-400/40 text-[9px] font-mono font-bold animate-pulse flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                          TURN
                        </span>
                      )}
                      <span className="font-mono text-xs font-black text-purple-400 bg-purple-950/90 px-1.5 py-0.5 rounded border border-purple-500/40">
                        {teamScores.teamB || 0} PTS
                      </span>
                    </div>
                  </div>

                  {/* Members List */}
                  <div className="flex flex-wrap gap-1">
                    {teamB.length > 0 ? (
                      teamB.map((p) => {
                        const isYou = p.sessionId === myPlayerId || p.id === myPlayerId || p.isYou;
                        const isLeader = p.isLeader || (p.socketId && p.socketId === leaderB);
                        return (
                          <span
                            key={p.sessionId || p.id}
                            className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold transition-all ${
                              currentTurnTeam === 'teamB'
                                ? isYou
                                  ? 'bg-purple-500/40 text-purple-100 border border-purple-300 shadow-sm'
                                  : 'bg-purple-950/80 text-purple-200 border border-purple-500/40'
                                : isYou
                                ? 'bg-purple-950/40 text-purple-200 border border-purple-500/20'
                                : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}
                          >
                            {isLeader && (
                              <span title="Team Leader" className="text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.8)] text-xs animate-pulse">
                                👑
                              </span>
                            )}
                            {p.isHost && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono" title="Room Host">
                                HOST
                              </span>
                            )}
                            <span className="truncate max-w-[80px] sm:max-w-[120px]">{p.name}</span>
                            {isYou && <span className="text-[8.5px] text-purple-300 font-mono font-normal">(You)</span>}
                            {!p.connected && <span className="text-[8.5px] text-rose-400" title="Disconnected">🔌</span>}
                            {isHost && !isLeader && (
                              <button
                                type="button"
                                onClick={() => handleAssignLeader(p.socketId, 'teamB')}
                                className="text-[8px] px-1 py-0.2 rounded bg-amber-400/20 hover:bg-amber-400/40 text-amber-300 border border-amber-400/30 ml-0.5 cursor-pointer transition-all active:scale-95"
                                title={`Make ${p.name} Team Leader`}
                              >
                                Make Leader
                              </button>
                            )}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">No players joined yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Role Banner */}
          <div id="role-banner" className="role-banner flex items-center justify-center gap-2 flex-wrap py-0.5 px-3 text-[10px] sm:text-xs my-0 flex-shrink-0" aria-live="polite">
            <span>
              {gameState === 'setting'
                ? (isWordSetter ? '👑 You are on the Word Setting Team — Choose a secret word' : '⏳ Opponent Team is choosing a secret word…')
                : (isWordSetter ? '👁 Watching — Your team set the word' : (isMyTeamTurn ? '🤔 Your Team’s Turn — Guess the secret word!' : '⏳ Opponent Team’s Turn to guess…'))}
            </span>
            {isPveMode && (
              <span className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-slate-200 shadow-sm">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  pveDifficulty === 'easy' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : pveDifficulty === 'hard' ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' : pveDifficulty === 'nightmare' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                }`} />
                <span className="font-bold text-yellow-300 uppercase">{pveDifficulty}</span>
                <span className="text-slate-500">•</span>
                <span>Round {pveRound}/{pveMaxRounds}</span>
              </span>
            )}
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
                    disabled={isVerifying}
                    onChange={(e) => {
                      setSecretWordInput(e.target.value.toUpperCase());
                      setWordValidationMsg('');
                    }}
                    onKeyDown={(e) => {
                      if (/^[a-zA-Z]$/.test(e.key) || e.key === 'Backspace' || e.key === ' ') {
                        playMechanicalClick();
                      }
                      if (e.key === 'Enter' && !isVerifying) handleSetWord(secretWordInput);
                    }}
                    spellCheck="false"
                  />
                  <button
                    id="btn-submit-word"
                    className="btn btn-primary min-w-[150px] inline-flex items-center justify-center gap-2"
                    disabled={isVerifying}
                    onClick={() => handleSetWord(secretWordInput)}
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <span>Submit Word</span>
                    )}
                  </button>
                </div>

                {wordValidationMsg && (
                  <div
                    id="word-validation-msg"
                    className="validation-msg error bg-rose-500/20 border border-rose-500/50 text-rose-300 font-bold p-3 rounded-lg text-center mt-3 animate-shake flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span className="text-base">⚠️</span>
                    <span>{wordValidationMsg}</span>
                  </div>
                )}

                {/* Real-Time Online Dictionary Meaning & Definition Card */}
                {(isLookingUpDef || (secretWordInput.length >= 3 && liveWordDef)) && (
                  <div className="w-full max-w-xl mx-auto my-3.5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#1b1830]/95 border border-purple-500/35 backdrop-blur-2xl shadow-xl transition-all animate-fadeIn">
                    {isLookingUpDef ? (
                      <div className="flex items-center justify-center gap-2.5 py-2 text-purple-300 font-mono text-xs sm:text-sm">
                        <div className="w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
                        <span>Parsing online dictionary for &ldquo;{secretWordInput}&rdquo;…</span>
                      </div>
                    ) : liveWordDef?.found ? (
                      <div className="flex flex-col gap-1.5 text-left">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-base sm:text-lg text-yellow-300 tracking-wider">
                              📖 {liveWordDef.word}
                            </span>
                            {liveWordDef.partOfSpeech && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 italic">
                                {liveWordDef.partOfSpeech}
                              </span>
                            )}
                            {liveWordDef.phonetic && (
                              <span className="text-[11px] sm:text-xs font-mono text-slate-400">
                                {liveWordDef.phonetic}
                              </span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ✓ Verified Dictionary Word
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans font-medium">
                          {liveWordDef.definition}
                        </p>
                        {liveWordDef.example && (
                          <p className="text-[11px] sm:text-xs text-purple-200/80 italic pl-2 border-l-2 border-purple-400/40 mt-0.5">
                            &ldquo;{liveWordDef.example}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-white/5">
                          <span>Source: {liveWordDef.source || 'Online Dictionary'}</span>
                          <span className="text-yellow-400/80">💡 Meaning will be provided as a clue hint</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-rose-300 font-mono text-xs sm:text-sm">
                        <span>⚠️</span>
                        <span>{liveWordDef?.reason || `No dictionary definition found for "${secretWordInput}".`}</span>
                      </div>
                    )}
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
                      onClick={() => {
                        playMechanicalClick();
                        refreshSuggestions();
                      }}
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
                        disabled={isVerifying}
                        onClick={() => {
                          playMechanicalClick();
                          const w = item.word.toUpperCase();
                          setSecretWordInput(w);
                          handleSetWord(w, item.meaning);
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
                  <div className="scramble-box" id="guesser-scramble-box" aria-hidden="true">
                    <span id="scramble-word" className="scramble-text">{scrambleText}</span>
                  </div>

                  <h2 className="panel-title">Word Setter is Choosing a Word…</h2>
                  <p className="panel-sub">Get ready to guess! Watch the timer above.</p>

                  <div className="setter-timer-ring-sm" id="guesser-wait-timer" aria-label="Time remaining">
                    <svg className="timer-svg" viewBox="0 0 100 100">
                      <circle className="timer-track" cx="50" cy="50" r="42" />
                      <circle
                        className={`timer-fill ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}
                        cx="50"
                        cy="50"
                        r="42"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={timerRingOffset}
                      />
                    </svg>
                    <div className="timer-inner">
                      <span className={`timer-val ${timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''}`}>
                        {timerSecondsLeft}
                      </span>
                    </div>
                  </div>

                  <div className="did-you-know" id="guesser-fact-card">
                    <div className="dyk-badge">💡 Did You Know?</div>
                    <p id="fact-text" className={`dyk-text transition-opacity duration-300 ${isFactFading ? 'opacity-0' : 'opacity-100'}`}>
                      {liveTriviaFact}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── GUESSER GUESSING PANEL (Active Guessing Phase) ───────────── */}
          {(gameState === 'guessing' || gameState === 'roundover') && !isWordSetter && (
            <section id="panel-guessing" className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col justify-between gap-1 sm:gap-1.5 md:gap-2 py-0.5 sm:py-1">
              
              {/* 1. TOP ROW: Gallows View & Secret Word Display */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 sm:gap-2.5 md:gap-3 items-stretch flex-1 min-h-0">
                
                {/* Left Column: Canvas (5 cols) */}
                <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl min-h-0">
                  <div className="font-mono text-[9px] sm:text-[10px] md:text-xs text-slate-300 uppercase tracking-widest font-bold">
                    Gallows View
                  </div>

                  <div className={`w-full max-w-[190px] sm:max-w-[220px] md:max-w-[250px] lg:max-w-[270px] aspect-[11/12] max-h-[160px] sm:max-h-[190px] md:max-h-[220px] lg:max-h-[240px] flex items-center justify-center bg-black/40 rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl p-1.5 sm:p-2 ${isGallowsSwinging ? 'hangman-swing' : ''}`}>
                    <canvas id="hangman-canvas" ref={hangmanCanvasRef} width={330} height={360} className="w-full h-full object-contain" />
                  </div>

                  {/* Stickman Live Dialogue Speech Pill - Only show after losing first life (mistakes >= 1) */}
                  {wrongGuesses.length >= 1 && currentDialogue && (
                    <div className={`w-full max-w-[260px] sm:max-w-[320px] px-2.5 py-1 rounded-lg sm:rounded-xl border backdrop-blur-md text-center transition-all duration-300 shadow-sm ${
                      stickmanMood === 'happy'
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : stickmanMood === 'mean' || stickmanMood === 'panic'
                        ? 'bg-rose-950/90 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-shake'
                        : 'bg-purple-950/80 border-purple-500/40 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    }`}>
                      <div className="text-[10px] sm:text-[11px] md:text-xs font-mono font-bold leading-tight flex items-center justify-center gap-1">
                        <span>{stickmanMood === 'happy' ? '😄' : stickmanMood === 'mean' ? '😈' : stickmanMood === 'panic' ? '😱' : '💬'}</span>
                        <span className="truncate">&ldquo;{currentDialogue}&rdquo;</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Secret Word Display + Clue (7 cols) */}
                <div className="md:col-span-7 lg:col-span-7 flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-3.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl text-center min-h-0">
                  <div className="flex items-center justify-between w-full px-1">
                    <div className="font-mono text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">
                      SECRET WORD ({hiddenWordChars.length} LETTERS)
                    </div>
                    {isHardDifficulty ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                        <span>🔒</span>
                        <span>NO HINTS IN HARD MODE</span>
                      </span>
                    ) : activeHint ? (
                      <button
                        type="button"
                        onClick={() => {
                          playMechanicalClick();
                          setShowHint(prev => {
                            const next = !prev;
                            if (next && activeHint && gameState === 'guessing' && !isWordSetter) {
                              speakDialogue(`Clue: ${activeHint}`);
                            }
                            return next;
                          });
                        }}
                        className="px-2 py-0.5 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/30 text-yellow-300 text-[9px] sm:text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95"
                        title={showHint ? "Hide Clue" : "Show Clue"}
                      >
                        <span>💡</span>
                        <span>{showHint ? "Hide Clue" : "Show Clue"}</span>
                      </button>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 md:gap-2 font-mono max-w-full my-0.5">
                    {hiddenWordChars.map((char, index) => {
                      const isRevealed = char !== '_';
                      const isNew = newGuessedSet.has(char);

                      return (
                        <div
                          key={index}
                          onClick={() => playMechanicalClick()}
                          className={`min-w-[28px] min-h-[36px] px-1 sm:w-9 sm:h-11 md:w-11 md:h-13 lg:w-13 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold uppercase transition-all duration-300 select-none shadow-sm cursor-pointer ${
                            isRevealed
                              ? `border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.5)] ${isNew ? 'letter-pop scale-105' : 'scale-100'}`
                              : 'bg-white/5 border border-white/10 text-white/30'
                          }`}
                        >
                          {isRevealed ? char : '_'}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sleek Glassmorphism Clue Banner right below SECRET WORD boxes */}
                  {!isHardDifficulty && clue && showHint && (
                    <div className="w-full bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 text-center mt-6 backdrop-blur-md flex items-center justify-center gap-2.5 shadow-lg animate-fadeIn">
                      <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                      <p className="text-slate-300 italic text-xs sm:text-sm md:text-base leading-relaxed">
                        Clue: &ldquo;{clue}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. MIDDLE ROW: Separated Health Bar & Wrong Letters */}
              <div className="w-full px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-3 flex-shrink-0">
                {/* Health & Big Hearts */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center sm:justify-start">
                  <span className="font-mono text-[9px] sm:text-[11px] md:text-xs font-bold tracking-widest uppercase text-slate-300 flex-shrink-0">
                    HEALTH:
                  </span>
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center">
                    {Array.from({ length: game?.maxLives || MAX_LIVES }).map((_, i) => (
                      <svg
                        key={i}
                        viewBox="0 0 24 24"
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-all duration-300 ${
                          i < livesLeft
                            ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.75)] scale-100'
                            : 'fill-white/10 text-white/10 scale-90'
                        }`}
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs md:text-sm font-bold text-rose-400 ml-0.5 flex-shrink-0">
                    ({livesLeft})
                  </span>
                </div>

                {/* Wrong Letters */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center sm:justify-end">
                  <span className="font-mono text-[9px] sm:text-[11px] md:text-xs font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">
                    WRONG LETTERS:
                  </span>
                  <div className="flex flex-wrap items-center gap-1 min-h-[20px]">
                    {wrongGuesses.length === 0 ? (
                      <span className="text-[10px] sm:text-xs text-slate-500 italic">None yet</span>
                    ) : (
                      wrongGuesses.map((l, i) => (
                        <span
                          key={i}
                          className={`px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-300 font-mono font-bold text-[10px] sm:text-xs shadow-sm ${
                            newWrongSet.has(l) ? 'wrong-tag-pop' : ''
                          }`}
                        >
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BOTTOM ROW: Interactive QWERTY Keyboard (Uniformly Responsive on Mobile & Laptop) */}
              <div className="w-full p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-[#12111f]/95 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col items-center gap-1 sm:gap-1.5 flex-shrink-0">
                <div className="font-mono text-[9px] sm:text-[10px] md:text-xs text-slate-300 uppercase tracking-widest text-center font-bold">
                  Interactive Virtual Keyboard
                </div>

                <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2 w-full max-w-5xl mx-auto touch-manipulation items-center px-1">
                  {KEYBOARD_ROWS.map((row, rIdx) => {
                    const rowWidthClass = rIdx === 0 ? 'w-full' : rIdx === 1 ? 'w-full max-w-[95%]' : 'w-full max-w-[80%]';
                    return (
                      <div key={rIdx} className={`flex justify-center gap-1 sm:gap-1.5 md:gap-2 ${rowWidthClass} touch-manipulation`}>
                        {row.map((letter) => {
                          const isGuessed = guessedSet.has(letter);
                          const isWrong = wrongSet.has(letter);
                          const isCorrect = isGuessed && !isWrong;

                          let keyClasses = '';
                          if (isCorrect) {
                            keyClasses = 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.6)] border-2 border-emerald-400 scale-95 cursor-default font-black';
                          } else if (isWrong) {
                            keyClasses = 'bg-rose-950/70 text-rose-500/70 line-through border border-rose-900/50 cursor-not-allowed scale-95 opacity-60';
                          } else {
                            keyClasses = 'bg-[#252338] text-white hover:bg-[#34314c] hover:border-purple-500/50 border border-white/15 active:scale-95 cursor-pointer shadow-md hover:shadow-purple-500/30';
                          }

                          return (
                            <button
                              key={letter}
                              type="button"
                              className={`flex-1 min-w-[24px] sm:min-w-[34px] md:min-w-[42px] max-w-[80px] h-9 sm:h-10 md:h-11 lg:h-12 xl:h-13 rounded-lg sm:rounded-xl font-mono font-black text-xs sm:text-base md:text-lg flex items-center justify-center uppercase transition-all select-none touch-manipulation active:scale-95 ${keyClasses}`}
                              aria-disabled={isGuessed || gameState === 'roundover'}
                              onClick={() => handleGuessLetter(letter)}
                              aria-label={`Letter ${letter}`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ─── SETTER WATCHING PANEL ────────────────────────────────────── */}
          {(gameState === 'guessing' || gameState === 'roundover') && isWordSetter && (
            <section id="panel-watching" className="w-full max-w-7xl mx-auto flex-1 min-h-0 flex flex-col justify-between gap-1 sm:gap-1.5 md:gap-2 py-0.5 sm:py-1">
              
              {/* 1. TOP ROW: Opponent's Gallows & Secret Word Display */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 sm:gap-2.5 md:gap-3 items-stretch flex-1 min-h-0">
                
                {/* Left Column: Canvas (5 cols) */}
                <div className="md:col-span-5 lg:col-span-5 flex flex-col items-center justify-center gap-1 sm:gap-1.5 p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl min-h-0">
                  <div className="font-mono text-[9px] sm:text-[10px] md:text-xs text-slate-300 uppercase tracking-widest font-bold">
                    Opponent&apos;s Gallows
                  </div>

                  <div className={`w-full max-w-[190px] sm:max-w-[220px] md:max-w-[250px] lg:max-w-[270px] aspect-[11/12] max-h-[160px] sm:max-h-[190px] md:max-h-[220px] lg:max-h-[240px] flex items-center justify-center bg-black/40 rounded-xl sm:rounded-2xl border border-white/10 shadow-2xl p-1.5 sm:p-2 ${isGallowsSwinging ? 'hangman-swing' : ''}`}>
                    <canvas id="hangman-canvas-watch" ref={hangmanWatchCanvasRef} width={330} height={360} className="w-full h-full object-contain" />
                  </div>

                  {/* Stickman Live Dialogue Speech Pill - Only show after losing first life (mistakes >= 1) */}
                  {wrongGuesses.length >= 1 && currentDialogue && (
                    <div className={`w-full max-w-[260px] sm:max-w-[320px] px-2.5 py-1 rounded-lg sm:rounded-xl border backdrop-blur-md text-center transition-all duration-300 shadow-sm ${
                      stickmanMood === 'happy'
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : stickmanMood === 'mean' || stickmanMood === 'panic'
                        ? 'bg-rose-950/90 border-rose-500/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-shake'
                        : 'bg-purple-950/80 border-purple-500/40 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    }`}>
                      <div className="text-[10px] sm:text-[11px] md:text-xs font-mono font-bold leading-tight flex items-center justify-center gap-1">
                        <span>{stickmanMood === 'happy' ? '😄' : stickmanMood === 'mean' ? '😈' : stickmanMood === 'panic' ? '😱' : '💬'}</span>
                        <span className="truncate">&ldquo;{currentDialogue}&rdquo;</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column: Secret Word Display for Chooser (7 cols) */}
                <div className="md:col-span-7 lg:col-span-7 flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-2 sm:p-3 md:p-3.5 rounded-xl sm:rounded-2xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl text-center min-h-0">
                  <div className="flex items-center justify-between w-full px-1">
                    <div className="font-mono text-[9px] sm:text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">
                      SECRET WORD ({cleanWord.length} LETTERS)
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5 md:gap-2 font-mono max-w-full my-0.5">
                    {cleanWord.split('').map((char, index) => {
                      const isGuessed = guessedSet.has(char);

                      return (
                        <div
                          key={index}
                          className={`min-w-[28px] min-h-[36px] px-1 sm:w-9 sm:h-11 md:w-11 md:h-13 lg:w-13 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-base sm:text-xl md:text-2xl lg:text-3xl font-extrabold uppercase transition-all duration-300 select-none shadow-sm ${
                            isGuessed
                              ? 'border-2 border-cyan-400 bg-cyan-500/20 text-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.5)] scale-100'
                              : 'bg-white/5 border-2 border-dashed border-white/20 text-white/40 scale-95'
                          }`}
                        >
                          {char}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sleek Glassmorphism Clue Banner right below SECRET WORD boxes */}
                  {clue && (
                    <div className="w-full bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-4 text-center mt-6 backdrop-blur-md flex items-center justify-center gap-2.5 shadow-lg animate-fadeIn">
                      <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
                      <p className="text-slate-300 italic text-xs sm:text-sm md:text-base leading-relaxed">
                        Clue: &ldquo;{clue}&rdquo;
                      </p>
                    </div>
                  )}

                  <div className="text-[9px] sm:text-[10px] md:text-xs font-mono text-purple-300/80 bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    Dashed boxes indicate letters your opponent has not guessed yet.
                  </div>
                </div>
              </div>

              {/* 2. MIDDLE ROW: Separated Opponent Health Bar */}
              <div className="w-full px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-xl bg-[#12111f]/90 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-3 flex-shrink-0">
                {/* Health & Big Hearts */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center sm:justify-start">
                  <span className="font-mono text-[9px] sm:text-[11px] md:text-xs font-bold tracking-widest uppercase text-slate-400 flex-shrink-0">
                    OPPONENT HEALTH:
                  </span>
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap justify-center">
                    {Array.from({ length: game?.maxLives || MAX_LIVES }).map((_, i) => (
                      <svg
                        key={i}
                        viewBox="0 0 24 24"
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 transition-all duration-300 ${
                          i < livesLeft
                            ? 'fill-rose-500 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.75)] scale-100'
                            : 'fill-white/10 text-white/10 scale-90'
                        }`}
                      >
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs md:text-sm font-bold text-rose-400 ml-0.5 flex-shrink-0">
                    ({livesLeft})
                  </span>
                </div>

                {/* Opponent's Wrong Letters */}
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center sm:justify-end">
                  <span className="font-mono text-[9px] sm:text-[11px] md:text-xs font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">
                    WRONG LETTERS:
                  </span>
                  <div className="flex flex-wrap items-center gap-1 min-h-[20px]">
                    {wrongGuesses.length === 0 ? (
                      <span className="text-[10px] sm:text-xs text-slate-500 italic">None yet</span>
                    ) : (
                      wrongGuesses.map((l, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-rose-300 font-mono font-bold text-[10px] sm:text-xs shadow-sm">
                          {l}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 3. BOTTOM ROW: Trivia / Facts Card */}
              <div className="w-full p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-semibold uppercase text-purple-300">
                  <span>💡</span>
                  <span>Hangman Trivia</span>
                </div>
                <p className={`text-[11px] sm:text-xs md:text-sm text-slate-300 leading-normal italic truncate transition-opacity duration-300 ${isFactFading ? 'opacity-0' : 'opacity-100'}`}>
                  &ldquo;{liveTriviaFact}&rdquo;
                </p>
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

                    {cleanWord && (
                      <div className="roundover-word" id="roundover-word" style={{ marginTop: '0.75rem' }}>
                        {cleanWord.split('').map((ch, idx) => (
                          <span key={idx} className="word-letter-span word-letter-unlocked cursor-pointer" style={{ '--index': idx }} onClick={() => playMechanicalClick()}>{ch}</span>
                        ))}
                      </div>
                    )}

                    {/* Word Meaning Box */}
                    <div className="w-full max-w-sm mx-auto my-3 p-3 sm:p-3.5 rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md shadow-inner text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-purple-300/90 mb-1">
                        <span>📖</span>
                        <span>Word Meaning</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
                        {wordMeaning || 'A valid English dictionary word.'}
                      </p>
                    </div>

                    <div className="w-full max-w-xs mx-auto my-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-around shadow-inner">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-cyan-300 max-w-[90px] truncate">{p1.name}</span>
                        <span className="font-display text-3xl sm:text-4xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">{p1.score}</span>
                      </div>
                      <span className="font-mono text-xs font-black text-purple-400/80 animate-pulse">VS</span>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-semibold text-purple-300 max-w-[90px] truncate">{p2.name}</span>
                        <span className="font-display text-3xl sm:text-4xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">{p2.score}</span>
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
                          <span key={idx} className={`${letterClass} cursor-pointer`} style={{ '--index': idx }} onClick={() => playMechanicalClick()}>{ch}</span>
                        );
                      })}
                    </div>

                    {/* Word Meaning / Definition Box */}
                    <div className="w-full max-w-sm mx-auto my-3 p-3 sm:p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 backdrop-blur-md shadow-inner text-center">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-purple-300/90 mb-1">
                        <span>📖</span>
                        <span>Word Meaning</span>
                      </div>
                      {isFetchingMeaning && !wordMeaning ? (
                        <p className="text-xs text-slate-400 italic animate-pulse">
                          Fetching definition…
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
                          {wordMeaning || 'A valid English dictionary word.'}
                        </p>
                      )}
                    </div>

                    {/* Aesthetic Round Over Scoreboard */}
                    <div className="w-full max-w-xs mx-auto my-2.5 p-2.5 sm:p-3 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-around shadow-inner">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] sm:text-xs font-semibold text-cyan-300 max-w-[90px] truncate">{p1.name}</span>
                        <span className="font-display text-2xl sm:text-3xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]">{p1.score}</span>
                      </div>
                      <span className="font-mono text-[10px] sm:text-xs font-black text-purple-400/80 animate-pulse">VS</span>
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] sm:text-xs font-semibold text-purple-300 max-w-[90px] truncate">{p2.name}</span>
                        <span className="font-display text-2xl sm:text-3xl font-black text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">{p2.score}</span>
                      </div>
                    </div>

                    {/* PvE: 10s auto-countdown + Instant Skip Button */}
                    {isPveMode ? (
                      <div className="w-full text-center mt-2 flex flex-col items-center gap-2">
                        <p className="text-xs sm:text-sm text-slate-300 font-medium">
                          {pveCountdown !== null
                            ? `Next round starting in ${pveCountdown}s…`
                            : 'Starting next round…'}
                        </p>
                        <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)] transition-all duration-1000 ease-linear"
                            style={{ width: `${((10 - (pveCountdown ?? 0)) / 10) * 100}%` }}
                          />
                        </div>
                        <button
                          id="btn-skip-countdown"
                          type="button"
                          onClick={handleSkipCountdown}
                          className="mt-1 px-5 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 hover:text-white text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95"
                        >
                          <span>Start Instantly ⚡</span>
                          <span className="text-[10px] text-purple-300/80 font-mono font-normal">(Press Enter ↵)</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        id="btn-next-round"
                        type="button"
                        disabled={isWaitingOpponent}
                        onClick={handleNextRound}
                        className="w-full max-w-sm mt-3 px-5 py-3 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/40 text-purple-200 hover:text-white text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{isWaitingOpponent ? 'Waiting for opponent…' : 'Next Round ⇄ Swap Roles'}</span>
                        {!isWaitingOpponent && (
                          <span className="text-[10px] text-purple-300/80 font-mono font-normal">(Press Enter ↵)</span>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </>
    )}
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
                  <span className="diff-tag">🟢 Easy</span>
                  <span className="diff-length">Familiar & High Vowels</span>
                </div>
                <p className="diff-desc">Simple, everyday words rich in vowels (A, E, I, O, U). 💡 Full clues & hints enabled.</p>
              </button>

              <button
                className="diff-btn diff-medium"
                type="button"
                onClick={() => startPveGame('medium', 1, null, pveMaxRounds)}
              >
                <div className="diff-header">
                  <span className="diff-tag">🟡 Medium</span>
                  <span className="diff-length">Standard Vocabulary</span>
                </div>
                <p className="diff-desc">Rich mix of everyday vocabulary and intermediate blends. 💡 Full clues & hints enabled.</p>
              </button>

              <button
                className="diff-btn diff-hard"
                type="button"
                onClick={() => startPveGame('hard', 1, null, pveMaxRounds)}
              >
                <div className="diff-header">
                  <span className="diff-tag">💀 Hard</span>
                  <span className="diff-length">Rare Letters • 🔒 No Hints</span>
                </div>
                <p className="diff-desc">Obscure, low-vowel & high-penalty words (e.g. RHYTHM, JINX, OXYGEN). 🚫 No clues or hints allowed!</p>
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

      {/* Opponent Reconnection Banner Overlay */}
      {disconnectNotice && (
        <div
          id="reconnection-overlay"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-amber-950/95 border border-amber-500/60 shadow-2xl backdrop-blur-xl text-amber-200 text-sm font-semibold animate-pulse"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
          </span>
          <span>
            Opponent <strong className="text-amber-100">{disconnectNotice.name}</strong> disconnected. Waiting for reconnection ({disconnectNotice.secondsLeft}s)...
          </span>
        </div>
      )}

      {/* Toast Notification */}
      <div key={toastKey} id="toast" className={`toast ${toastMsg ? '' : 'hidden'}`} role="status">
        {toastMsg}
      </div>
    </>
  );
}
