  /**
 * client.js — Hangman Duel Frontend
 * Handles all Socket.io events and DOM interactions.
 */

const socket = io({
  transports: ['websocket'],
  upgrade: false,
});

// ─── DOM References ─────────────────────────────────────────────────────────
const screens = {
  lobby:   document.getElementById('screen-lobby'),
  waiting: document.getElementById('screen-waiting'),
  game:    document.getElementById('screen-game'),
};

// Lobby
const inputName     = document.getElementById('input-name');
const inputRoomCode = document.getElementById('input-room-code');
const btnCreate     = document.getElementById('btn-create');
const btnJoin       = document.getElementById('btn-join');
const lobbyError    = document.getElementById('lobby-error');

// Lobby — PvE Mode
const btnPve          = document.getElementById('btn-pve');
const modalDifficulty = document.getElementById('modal-difficulty');
const btnCancelPve    = document.getElementById('btn-cancel-pve');
const diffButtons     = document.querySelectorAll('.diff-btn');

// Lobby — host settings
const btnAdvanced   = document.getElementById('btn-advanced');
const hostSettings  = document.getElementById('host-settings');
const selectTimer   = document.getElementById('select-timer');

// Waiting
const displayRoomCode  = document.getElementById('display-room-code');
const btnCopyCode      = document.getElementById('btn-copy-code');
const btnLeaveWaiting  = document.getElementById('btn-leave-waiting');

// Game header
const headerRoomCode   = document.getElementById('header-room-code');
const btnLeaveGame     = document.getElementById('btn-leave-game');
const scoreNameP1      = document.getElementById('score-name-p1');
const scoreValP1       = document.getElementById('score-val-p1');
const scoreNameP2      = document.getElementById('score-name-p2');
const scoreValP2       = document.getElementById('score-val-p2');

// Game panels
const roleBanner          = document.getElementById('role-banner');
const panelWordSetter     = document.getElementById('panel-word-setter');
const panelGuesserWaiting = document.getElementById('panel-guesser-waiting');
const panelGuesser        = document.getElementById('panel-guesser');
const panelWatching       = document.getElementById('panel-watching');
const inputWord           = document.getElementById('input-word');
const btnSubmitWord       = document.getElementById('btn-submit-word');
const wordValidationMsg   = document.getElementById('word-validation-msg');
const setterWaitingMsg    = document.getElementById('setter-waiting-msg');

// Word Suggestions elements
const wordSuggestionsGrid   = document.getElementById('word-suggestions-grid');
const btnRefreshSuggestions = document.getElementById('btn-refresh-suggestions');

// Setter timer ring
const setterTimerVal     = document.getElementById('setter-timer-val');
const timerRingFill      = document.getElementById('timer-ring-fill');
const RING_CIRCUMFERENCE = 263.9; // 2*pi*42

// Guesser elements
const hangmanCanvas      = document.getElementById('hangman-canvas');
const livesLeftEl        = document.getElementById('lives-left');
const wrongLettersEl     = document.getElementById('wrong-letters');
const wordDisplayEl      = document.getElementById('word-display');
const keyboardEl         = document.getElementById('keyboard');

// Watcher elements
const hangmanCanvasWatch = document.getElementById('hangman-canvas-watch');
const livesLeftWatch     = document.getElementById('lives-left-watch');
const wrongLettersWatch  = document.getElementById('wrong-letters-watch');
const wordDisplayWatch   = document.getElementById('word-display-watch');
const yourWordReveal     = document.getElementById('your-word-reveal');
const keyboardWatch      = document.getElementById('keyboard-watch');
const randomFactWatch    = document.getElementById('random-fact-watch');

// Guesser waiting panel
const particleCanvas = document.getElementById('particle-canvas');
const scrambleEl     = document.getElementById('scramble-text');
const gwTimerFill    = document.getElementById('gw-timer-fill');
const gwTimerVal     = document.getElementById('gw-timer-val');
const randomFactText = document.getElementById('random-fact-text');

// Round over
const overlayRoundover   = document.getElementById('overlay-roundover');
const roundoverIcon      = document.getElementById('roundover-icon');
const roundoverTitle     = document.getElementById('roundover-title');
const roundoverSubtitle  = document.getElementById('roundover-subtitle');
const roundoverWord      = document.getElementById('roundover-word');
const roundoverScores    = document.getElementById('roundover-scores');
const btnNextRound       = document.getElementById('btn-next-round');

// Toast
const toast = document.getElementById('toast');

// ─── Local State ─────────────────────────────────────────────────────────────
let myRoomCode = null;
let toastTimeout = null;
let timerState = { secondsLeft: 0, total: 60 };
let prevGuessedLetters = [];
let prevWrongGuesses = [];

// ─── PvE Single-Player State ──────────────────────────────────────────────────
let isPveMode = false;
let pveDifficulty = 'medium';
let pveDictionary = [];
let pveScore = { human: 0, bot: 0 };
let pveGame = null;
let pveState = null;

// Preload dictionary for instant PvE single-player play
fetch('/dictionary.json')
  .then(res => res.json())
  .then(data => {
    if (Array.isArray(data)) pveDictionary = data;
  })
  .catch(() => {});

// ─── Keyboard layout ─────────────────────────────────────────────────────────
const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];

// ─── Screen Navigation ────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.remove('hidden');
}
function hideLobbyError() {
  lobbyError.classList.add('hidden');
}

// ─── Advanced Settings Toggle ────────────────────────────────────────────────
btnAdvanced.addEventListener('click', () => {
  const expanded = btnAdvanced.getAttribute('aria-expanded') === 'true';
  btnAdvanced.setAttribute('aria-expanded', String(!expanded));
  hostSettings.setAttribute('aria-hidden', String(expanded));
  hostSettings.classList.toggle('expanded', !expanded);
  hostSettings.classList.toggle('collapsed', expanded);
});

btnCreate.addEventListener('click', () => {
  hideLobbyError();
  const name = inputName.value.trim();
  if (!name) { showLobbyError('Please enter your name first.'); return; }
  const wordPickTime = Number(selectTimer.value) || 60;
  socket.emit('create_room', { playerName: name, wordPickTime });
});


btnJoin.addEventListener('click', () => {
  hideLobbyError();
  const name = inputName.value.trim();
  const code = inputRoomCode.value.trim().toUpperCase();
  if (!name) { showLobbyError('Please enter your name first.'); return; }
  if (!code || code.length < 4) { showLobbyError('Enter a valid room code.'); return; }
  socket.emit('join_room', { roomCode: code, playerName: name });
});

// Enter key support in lobby
inputName.addEventListener('keydown', e => { if (e.key === 'Enter') btnCreate.click(); });
inputRoomCode.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

// Auto-join from invite link in public/client.js
try {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const joinParam = urlParams.get('join') || urlParams.get('room');
    if (joinParam && joinParam.trim().length >= 4) {
      const cleanJoin = joinParam.trim().toUpperCase().slice(0, 6);
      if (inputRoomCode) inputRoomCode.value = cleanJoin;
      if (inputName && !inputName.value.trim()) {
        inputName.value = 'Player ' + Math.floor(100 + Math.random() * 900);
      }
      setTimeout(() => {
        if (btnJoin) btnJoin.click();
      }, 300);
    }
  }
} catch (e) {}

// Copy room code
btnCopyCode.addEventListener('click', () => {
  if (!myRoomCode) return;
  navigator.clipboard.writeText(myRoomCode).then(() => showToast('Room code copied! 📋'));
});
displayRoomCode.addEventListener('click', () => btnCopyCode.click());

// ─── PvE Single-Player Mode Setup ─────────────────────────────────────────────
if (btnPve) {
  btnPve.addEventListener('click', () => {
    hideLobbyError();
    const name = inputName.value.trim();
    if (!name) {
      showLobbyError('Please enter your name first.');
      inputName.focus();
      return;
    }
    if (modalDifficulty) modalDifficulty.classList.remove('hidden');
  });
}

if (btnCancelPve) {
  btnCancelPve.addEventListener('click', () => {
    if (modalDifficulty) modalDifficulty.classList.add('hidden');
  });
}

if (modalDifficulty) {
  modalDifficulty.addEventListener('click', (e) => {
    if (e.target === modalDifficulty) {
      modalDifficulty.classList.add('hidden');
    }
  });
}

diffButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = btn.getAttribute('data-difficulty') || 'medium';
    if (modalDifficulty) modalDifficulty.classList.add('hidden');
    startPveGame(diff);
  });
});

function startPveGame(difficulty) {
  isPveMode = true;
  pveDifficulty = difficulty;
  pveScore = { human: 0, bot: 0 };
  startPveRound(difficulty);
}

function startPveRound(difficulty) {
  isPveMode = true;
  let pool = [];
  if (difficulty === 'easy') {
    // Easy: 4 to 5 letters
    pool = pveDictionary.filter(item => {
      const len = (typeof item === 'string' ? item : item.word).length;
      return len >= 4 && len <= 5;
    });
  } else if (difficulty === 'hard') {
    // Hard: 9 or more letters
    pool = pveDictionary.filter(item => {
      const len = (typeof item === 'string' ? item : item.word).length;
      return len >= 9;
    });
  } else {
    // Medium: 6 to 8 letters
    pool = pveDictionary.filter(item => {
      const len = (typeof item === 'string' ? item : item.word).length;
      return len >= 6 && len <= 8;
    });
  }

  if (!pool.length) pool = pveDictionary;
  if (!pool.length) {
    pool = [
      { word: 'ECLIPSE', meaning: 'The obscuring of light from a celestial body.' },
      { word: 'CRYSTAL', meaning: 'A homogeneous solid substance.' },
      { word: 'GALAXY',  meaning: 'A gravitationally bound system of stars.' }
    ];
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const rawWord = (typeof chosen === 'string' ? chosen : chosen.word).toLowerCase().trim();
  const meaning = (typeof chosen === 'object' && chosen.meaning) ? chosen.meaning : '';

  pveGame = {
    word: rawWord,
    meaning: meaning,
    hiddenWord: rawWord.split('').map(() => '_').join(''),
    guessedLetters: [],
    wrongGuesses: [],
    livesLeft: 10,
    maxLives: 10,
    wordSetterId: 'bot',
    guesserId: 'human',
    roundResult: null,
    isWordSetter: false
  };

  const playerName = inputName.value.trim() || 'You';

  pveState = {
    state: 'guessing',
    players: [
      { id: 'human', name: playerName, score: pveScore.human, isYou: true },
      { id: 'bot', name: 'Computer 🤖', score: pveScore.bot, isYou: false }
    ],
    game: pveGame,
    roomCode: `SOLO-${difficulty.toUpperCase()}`
  };

  showScreen('game');
  applyState(pveState);
}

function handlePveGuess(letter) {
  if (!isPveMode || !pveGame || !pveState || pveState.state !== 'guessing') return;
  const l = letter.toLowerCase();
  if (pveGame.guessedLetters.includes(l)) return;

  pveGame.guessedLetters.push(l);

  if (pveGame.word.includes(l)) {
    // Reveal letter
    pveGame.hiddenWord = pveGame.word
      .split('')
      .map(ch => pveGame.guessedLetters.includes(ch) ? ch : '_')
      .join('');

    if (!pveGame.hiddenWord.includes('_')) {
      pveGame.roundResult = 'guesser_wins';
      pveScore.human++;
      pveState.players[0].score = pveScore.human;
      pveState.state = 'roundover';
    }
  } else {
    // Wrong guess
    pveGame.wrongGuesses.push(l);
    pveGame.livesLeft--;
    if (pveGame.livesLeft <= 0) {
      pveGame.roundResult = 'setter_wins';
      pveScore.bot++;
      pveState.players[1].score = pveScore.bot;
      pveState.state = 'roundover';
    }
  }

  applyState(pveState);
}

// Leave buttons
[btnLeaveWaiting, btnLeaveGame].forEach(btn => {
  btn.addEventListener('click', () => {
    if (isPveMode) {
      isPveMode = false;
      pveGame = null;
      pveState = null;
      overlayRoundover.classList.add('hidden');
      showScreen('lobby');
      hideLobbyError();
      return;
    }
    socket.disconnect();
    socket.connect();
    myRoomCode = null;
    showScreen('lobby');
    hideLobbyError();
  });
});

// ─── Word Setter ──────────────────────────────────────────────────────────────
btnSubmitWord.addEventListener('click', submitWord);
inputWord.addEventListener('keydown', e => { if (e.key === 'Enter') submitWord(); });

function submitWord() {
  const word = inputWord.value.trim();
  if (!word) return;
  btnSubmitWord.disabled = true;
  socket.emit('set_word', { word });
}

// ─── State Authority & Modal Management ───────────────────────────────────────
let currentRoundToken = 0;
let activeSpecialAnimId = null;

function stopSpecialAnimations() {
  if (activeSpecialAnimId) {
    cancelAnimationFrame(activeSpecialAnimId);
    activeSpecialAnimId = null;
  }
}

function forceCloseGameOverModal() {
  stopSpecialAnimations();
  overlayRoundover.classList.add('hidden');
  overlayRoundover.classList.remove('loss-theme', 'win-theme', 'victory-theme', 'defeat-theme', 'guesser-victory-theme', 'setter-defeat-theme');
  btnNextRound.disabled = false;
  btnNextRound.textContent = isPveMode ? 'Play Again ↻' : 'Next Round ↩ Swap Roles';
}

// ─── Dynamic Performance Dialogues (Guesser Wins) ─────────────────────────────
const GUESSER_PERFORMANCE_DIALOGUES = {
  tier1_flawless: [
    "You aced it! 🎯",
    "Flawless Victory! ⚡",
    "Absolute Mind Reader! 🧠",
    "Untouched! 🏆",
    "Zero Mistakes! Pure Genius! ✨"
  ],
  tier2_great: [
    "Too easy! 😎",
    "Great job! 🔥",
    "Quick work! ⚡",
    "Solid performance! 👏",
    "Smooth sailing! ⛵"
  ],
  tier3_average: [
    "Got there eventually! 😅",
    "Sweating a little? 💦",
    "Halfway to the gallows! ⛓️",
    "A bit close for comfort! 🎩",
    "Hard-fought escape! ⚔️"
  ],
  tier4_closeCall: [
    "By the skin of your teeth! 😱",
    "That was too close! 🚨",
    "Barely survived! 🧗",
    "One step from the drop! 🪢",
    "Miraculous Escape! ⚡"
  ]
};

const SETTER_PERFORMANCE_DIALOGUES = {
  tier1_flawless: [
    "They aced it! 🎯",
    "Your word was too easy! ⚡",
    "They read your mind! 🧠",
    "Flawless solve on your word! 🏆",
    "Zero mistakes against you! ✨"
  ],
  tier2_great: [
    "They made quick work of that! 🔥",
    "They cracked it with ease! ⚡",
    "Solid guessing against your word! 👏",
    "Barely broke a sweat on your word! 😎"
  ],
  tier3_average: [
    "They got there eventually! 😅",
    "You made them sweat a bit! 💦",
    "They were halfway to the rope! ⛓️",
    "You almost had them on the ropes! ⚔️"
  ],
  tier4_closeCall: [
    "They escaped by the skin of their teeth! 😱",
    "So close to the drop! 🪢",
    "They barely slipped away from you! 🧗",
    "One mistake away from victory! 🚨",
    "Heartbreaker! You almost had them! 💔"
  ]
};

function getRandomPerformanceDialogue(mistakes, isWinningGuesser) {
  const pool = isWinningGuesser ? GUESSER_PERFORMANCE_DIALOGUES : SETTER_PERFORMANCE_DIALOGUES;
  let tierList;

  if (mistakes === 0) {
    tierList = pool.tier1_flawless;
  } else if (mistakes >= 1 && mistakes <= 3) {
    tierList = pool.tier2_great;
  } else if (mistakes >= 4 && mistakes <= 6) {
    tierList = pool.tier3_average;
  } else {
    // 7 to 9 mistakes
    tierList = pool.tier4_closeCall;
  }

  const randomIndex = Math.floor(Math.random() * tierList.length);
  return tierList[randomIndex];
}

// ─── Next Round ───────────────────────────────────────────────────────────────
btnNextRound.addEventListener('click', () => {
  if (isPveMode) {
    forceCloseGameOverModal();
    startPveRound(pveDifficulty);
  } else {
    // Immediate visual feedback & disable spamming
    btnNextRound.disabled = true;
    btnNextRound.textContent = 'Waiting for opponent…';
    socket.emit('next_round');
  }
});

// Physical keyboard for guessing
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const key = e.key.toLowerCase();
  if (/^[a-z]$/.test(key) && !panelGuesser.classList.contains('hidden')) {
    if (isPveMode) {
      handlePveGuess(key);
    } else {
      socket.emit('guess_letter', { letter: key });
    }
  }
});


// ─── Hangman Canvas Drawing ───────────────────────────────────────────────────
//
// Exact 10-step drawing sequence (one part revealed per wrong guess):
//   Mistake 0  → blank canvas
//   Mistake 1  → base (horizontal ground line)
//   Mistake 2  → pole (vertical)
//   Mistake 3  → top beam (horizontal)
//   Mistake 4  → rope (short drop from beam end)
//   Mistake 5  → head (circle)
//   Mistake 6  → body (torso)
//   Mistake 7  → left arm
//   Mistake 8  → right arm
//   Mistake 9  → left leg
//   Mistake 10 → right leg + X eyes (dead) + swing animation

// ── Neon colour helpers ──────────────────────────────────────────────────────
const NEON_GALLOWS = '#7c3aed';          // violet — structural parts
const NEON_GALLOWS_GLOW = '#a855f7';     // brighter violet for shadow
const NEON_BODY   = '#c084fc';          // lighter violet — figure
const NEON_DEAD   = '#ef4444';          // red — dead state
const NEON_DEAD_GLOW = '#fca5a5';       // red glow

function applyGlow(ctx, color, blur = 10) {
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
}
function clearGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
}

// ── Pen Tip Spark ─────────────────────────────────────────────────────────────
function drawPenTip(ctx, x, y, glowColor) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = glowColor || '#06b6d4';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Static & Progressive Steps ────────────────────────────────────────────────
function drawStaticStep(ctx, stepIndex, isDead) {
  drawProgressiveStep(ctx, stepIndex, 1.0, isDead, false);
}

function drawProgressiveStep(ctx, stepIndex, progress, isDead, withTip = true) {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return;

  switch (stepIndex) {
    case 0: { // Step 1 — Base
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
    case 1: { // Step 2 — Main Vertical Pole
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
    case 2: { // Step 3 — Top Beam
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
    case 3: { // Step 4 — Rope
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
    case 4: { // Step 5 — Head
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
    case 5: { // Step 6 — Torso
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
    case 6: { // Step 7 — Left Arm
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
    case 7: { // Step 8 — Right Arm
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
    case 8: { // Step 9 — Left Leg
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
    case 9: { // Step 10 — Right Leg + X Eyes
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
}

// Track animation state per canvas
const canvasAnimMap = new WeakMap();

function getCanvasAnimState(canvas) {
  if (!canvasAnimMap.has(canvas)) {
    canvasAnimMap.set(canvas, { drawnSteps: 0, animId: null });
  }
  return canvasAnimMap.get(canvas);
}

/**
 * drawHangman — redraws or smoothly animates new mistake lines with glowing neon pen
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} livesLeft   — remaining lives (10 = start, 0 = dead)
 * @param {number} maxLives    — total lives (default 10)
 * @param {boolean} animate    — whether to animate newly added mistake lines
 */
function drawHangman(canvas, livesLeft, maxLives = 10, animate = true) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const targetSteps = Math.min(Math.max(0, maxLives - livesLeft), 10);
  const isDead = livesLeft <= 0;
  const state = getCanvasAnimState(canvas);

  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }

  function drawAllStatic() {
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
  }

  // Reset or instantaneous render
  if (targetSteps === 0 || targetSteps <= state.drawnSteps || !animate) {
    drawAllStatic();
    state.drawnSteps = targetSteps;
    return;
  }

  const latestStepIdx = targetSteps - 1;
  state.drawnSteps = targetSteps;

  const STEP_DURATION = 180; // ms per step
  const startTime = performance.now();

  function stepFrame(now) {
    const elapsed = now - startTime;
    const rawProgress = Math.min(1, elapsed / STEP_DURATION);
    const progress = 1 - Math.pow(1 - rawProgress, 3); // ease-out cubic

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Static completed lines up to latest step
    for (let i = 0; i < latestStepIdx; i++) {
      drawStaticStep(ctx, i, isDead);
    }

    // 2. Active line being traced with glowing pen tip
    drawProgressiveStep(ctx, latestStepIdx, progress, isDead, rawProgress < 1);

    ctx.restore();

    if (rawProgress < 1) {
      state.animId = requestAnimationFrame(stepFrame);
    } else {
      state.animId = null;
      drawAllStatic();
    }
  }

  state.animId = requestAnimationFrame(stepFrame);
}

/**
 * triggerDeathAnimation — When the Guesser loses (10th mistake):
 * 1. The floor line (base of the gallows) under the stick figure drops/opens away like a trapdoor (0..320ms).
 * 2. The stick figure drops down taut and swings gently back and forth like a damped pendulum for ~1.8s.
 * 3. The rope "snaps" (erases line, leaves top & neck frayed stubs), and the stick figure accelerates straight down off the bottom edge of the canvas (1.8s..3.5s).
 * 4. Delays calling callback() until the full sequence completes (~3500ms) before the modal appears.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Function} callback
 */
function triggerDeathAnimation(canvas, callback) {
  if (!canvas) { callback(); return; }
  const ctx = canvas.getContext('2d');
  const startTime = performance.now();
  const DURATION = 3500; // 3.5 seconds total
  const SNAP_TIME = 1800; // Rope snaps at 1.8s
  const thisAnimRoundToken = currentRoundToken;

  // Stop any active drawing animation on this canvas
  const state = getCanvasAnimState(canvas);
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  stopSpecialAnimations();

  // Anchor point at top beam
  const anchorX = 145;
  const anchorY = 18;

  function animate(now) {
    // If round has transitioned, abort animation immediately
    if (thisAnimRoundToken !== currentRoundToken) {
      activeSpecialAnimId = null;
      return;
    }

    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / DURATION);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // ── 1. GALLOWS VERTICAL POLE & TOP BEAM ──
    ctx.strokeStyle = NEON_GALLOWS;
    applyGlow(ctx, NEON_GALLOWS_GLOW, 12);
    ctx.lineWidth = 5;

    // Vertical pole (55, 225) -> (55, 18)
    ctx.beginPath();
    ctx.moveTo(55, 225);
    ctx.lineTo(55, 18);
    ctx.stroke();

    // Top beam (55, 18) -> (145, 18)
    ctx.beginPath();
    ctx.moveTo(55, 18);
    ctx.lineTo(145, 18);
    ctx.stroke();
    clearGlow(ctx);

    // ── 2. BASE PLATFORM & DROPPING TRAPDOOR ──
    // Left steady base: (15, 225) to (95, 225)
    ctx.strokeStyle = NEON_GALLOWS;
    applyGlow(ctx, NEON_GALLOWS_GLOW, 12);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(15, 225);
    ctx.lineTo(95, 225);
    ctx.stroke();

    // Right trapdoor flap: pivots down around hinge (95, 225)
    const doorProgress = Math.min(1, elapsed / 320);
    const doorEase = 1 - Math.cos((doorProgress * Math.PI) / 2);
    const doorAngle = doorEase * (Math.PI * 0.44); // drops down ~80 degrees
    const doorLen = 90;

    ctx.beginPath();
    ctx.moveTo(95, 225);
    ctx.lineTo(95 + Math.cos(doorAngle) * doorLen, 225 + Math.sin(doorAngle) * doorLen);
    ctx.stroke();
    clearGlow(ctx);

    // ── 3. SUSPENDED PENDULUM OR ROPE-SNAP FREE-FALL ──
    if (elapsed < SNAP_TIME) {
      // ── PRE-SNAP: TAUT ROPE & PENDULUM SWING ──
      const swingTime = Math.max(0, (elapsed - 150) / 1000);
      const decay = Math.exp(-0.95 * swingTime);
      const swingAngle = 0.24 * decay * Math.sin(6.8 * swingTime);

      const dropProgress = Math.min(1, elapsed / 220);
      const dropOffset = Math.sin(dropProgress * Math.PI * 0.5) * 10;
      const ropeLength = 36 + dropOffset;

      // Draw taut rope from beam anchor (145, 18) to neck attachment
      const neckAttachX = anchorX + Math.sin(swingAngle) * ropeLength;
      const neckAttachY = anchorY + Math.cos(swingAngle) * ropeLength;

      ctx.strokeStyle = NEON_DEAD;
      applyGlow(ctx, NEON_DEAD_GLOW, 10);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(neckAttachX, neckAttachY);
      ctx.stroke();
      clearGlow(ctx);

      // Draw swinging body attached at neck
      ctx.save();
      ctx.translate(neckAttachX, neckAttachY);
      ctx.rotate(swingAngle);

      ctx.strokeStyle = NEON_DEAD;
      applyGlow(ctx, NEON_DEAD_GLOW, 12);

      // 1. Head (tilted dead hanging pose)
      const headRadius = 18;
      const headCy = -headRadius;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, headCy, headRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Dead X Eyes
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, headCy - 7); ctx.lineTo(-4, headCy - 1);
      ctx.moveTo(-4, headCy - 7);  ctx.lineTo(-10, headCy - 1);
      ctx.moveTo(4, headCy - 7);  ctx.lineTo(10, headCy - 1);
      ctx.moveTo(10, headCy - 7); ctx.lineTo(4, headCy - 1);
      ctx.stroke();

      // 3. Torso
      const neckY = headCy + headRadius;
      const torsoLen = 64;
      const hipY = neckY + torsoLen;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, neckY);
      ctx.lineTo(0, hipY);
      ctx.stroke();

      // 4. Limp Dangling Arms (slight inertial lag)
      const shoulderY = neckY + 14;
      const armLag = Math.sin(swingAngle * 2.0) * 4;
      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(-24 + armLag, shoulderY + 36);
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(24 + armLag, shoulderY + 36);
      ctx.stroke();

      // 5. Limp Dangling Legs (hanging down with slight inertia)
      const legLag = Math.sin(swingAngle * 1.8) * 5;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(-15 + legLag, hipY + 48);
      ctx.moveTo(0, hipY);
      ctx.lineTo(15 + legLag, hipY + 48);
      ctx.stroke();

      clearGlow(ctx);
      ctx.restore();

    } else {
      // ── POST-SNAP: ROPE SNAPS & STICK FIGURE FREE-FALLS ACCELERATING OFF CANVAS ──
      const fallSec = (elapsed - SNAP_TIME) / 1000;

      // 1. Draw frayed broken rope stub on the top beam (anchorX, anchorY)
      ctx.strokeStyle = NEON_DEAD;
      applyGlow(ctx, NEON_DEAD_GLOW, 10);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(anchorX - 2, anchorY + 7);
      ctx.lineTo(anchorX + 2, anchorY + 11);
      ctx.stroke();
      clearGlow(ctx);

      // Snap position & angle at t = 1.8s
      const snapSwingTime = (SNAP_TIME - 150) / 1000;
      const snapDecay = Math.exp(-0.95 * snapSwingTime);
      const snapAngle = 0.24 * snapDecay * Math.sin(6.8 * snapSwingTime);

      const snapRopeLen = 36;
      const startX = anchorX + Math.sin(snapAngle) * snapRopeLen;
      const startY = anchorY + Math.cos(snapAngle) * snapRopeLen;

      // Gravity acceleration physics: y = y0 + 0.5 * g * t^2, g = 850 px/s^2
      const g = 850;
      const fallY = startY + 0.5 * g * (fallSec * fallSec);
      const fallX = startX + snapAngle * 35 * fallSec;
      const tumbleAngle = snapAngle + fallSec * 0.45;

      // Draw falling stick figure
      ctx.save();
      ctx.translate(fallX, fallY);
      ctx.rotate(tumbleAngle);

      ctx.strokeStyle = NEON_DEAD;
      ctx.moveTo(0, 0);
      ctx.lineTo(-2, -5);
      ctx.lineTo(2, -9);
      ctx.stroke();

      // Head with X eyes
      const headRadius = 20;
      const headCy = headRadius;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, headCy, headRadius, 0, Math.PI * 2);
      ctx.stroke();

      // X Eyes
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, headCy - 7); ctx.lineTo(-4, headCy - 1);
      ctx.moveTo(-4, headCy - 7); ctx.lineTo(-10, headCy - 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, headCy - 7); ctx.lineTo(10, headCy - 1);
      ctx.moveTo(10, headCy - 7); ctx.lineTo(4, headCy - 1);
      ctx.stroke();

      // Torso
      const neckY = headCy + headRadius;
      const torsoLen = 64;
      const hipY = neckY + torsoLen;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(0, neckY);
      ctx.lineTo(0, hipY);
      ctx.stroke();

      // Flailing arms in free fall
      const shoulderY = neckY + 14;
      const armFlail = Math.sin(fallSec * 16) * 6;
      ctx.beginPath();
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(-28 + armFlail, shoulderY + 18);
      ctx.moveTo(0, shoulderY);
      ctx.lineTo(28 - armFlail, shoulderY + 18);
      ctx.stroke();

      // Flailing legs in free fall
      const legFlail = Math.cos(fallSec * 14) * 8;
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(-18 + legFlail, hipY + 48);
      ctx.moveTo(0, hipY);
      ctx.lineTo(18 - legFlail, hipY + 48);
      ctx.stroke();

      clearGlow(ctx);
      ctx.restore();
    }

    ctx.restore();

    if (progress < 1) {
      activeSpecialAnimId = requestAnimationFrame(animate);
    } else {
      activeSpecialAnimId = null;
      if (thisAnimRoundToken === currentRoundToken) {
        callback();
      }
    }
  }

  activeSpecialAnimId = requestAnimationFrame(animate);
}

/**
 * triggerEscapeAnimation — When the Guesser wins, animates the stick figure
 * breaking free from the rope, landing with a squash/bounce on the ground,
 * and enthusiastically running off the right edge of the canvas.
 * Delays calling callback() until the animation completes (~1.8s).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} livesLeft
 * @param {number} maxLives
 * @param {Function} callback
 */
function triggerEscapeAnimation(canvas, livesLeft, maxLives, callback) {
  if (!canvas) { callback(); return; }
  const ctx = canvas.getContext('2d');
  const wrongGuesses = maxLives - livesLeft;
  const startTime = performance.now();
  const DURATION = 1800; // ms
  const thisAnimRoundToken = currentRoundToken;

  const state = getCanvasAnimState(canvas);
  if (state.animId) {
    cancelAnimationFrame(state.animId);
    state.animId = null;
  }
  stopSpecialAnimations();

  const dustParticles = [];

  function animate(now) {
    if (thisAnimRoundToken !== currentRoundToken) {
      activeSpecialAnimId = null;
      return;
    }

    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / DURATION);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw static gallows (base, pole, top beam)
    if (wrongGuesses >= 1) {
      ctx.strokeStyle = NEON_GALLOWS;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(20, 225); ctx.lineTo(90, 225);
      ctx.stroke();
      clearGlow(ctx);
    }
    if (wrongGuesses >= 2) {
      ctx.strokeStyle = NEON_GALLOWS;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(55, 225); ctx.lineTo(55, 18);
      ctx.stroke();
      clearGlow(ctx);
    }
    if (wrongGuesses >= 3) {
      ctx.strokeStyle = NEON_GALLOWS;
      applyGlow(ctx, NEON_GALLOWS_GLOW, 10);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(55, 18); ctx.lineTo(145, 18);
      ctx.stroke();
      clearGlow(ctx);
    }
    // Broken Snapped Rope dangling from beam
    if (wrongGuesses >= 4) {
      ctx.strokeStyle = '#f59e0b';
      applyGlow(ctx, 'rgba(245, 158, 11, 0.7)', 8);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(145, 18); ctx.lineTo(145, 30);
      ctx.stroke();
      clearGlow(ctx);
    }

    // Ground line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 225); ctx.lineTo(canvas.width, 225);
    ctx.stroke();

    // 2. Compute Stick Figure position & kinematics
    let figX = 145;
    const groundY = 225;
    let hipY = 178;
    const torsoLen = 42;
    const headRadius = 18;
    let legCycle = 0;
    let isRunning = false;

    if (elapsed < 350) {
      // Drop phase with bounce
      const dropP = elapsed / 350;
      const dropEased = dropP * dropP;
      hipY = 135 + dropEased * 43; // lands at ground level
      figX = 145;
    } else {
      // Running phase: accelerates off canvas to the right
      isRunning = true;
      const runElapsed = elapsed - 350;
      const runSpeed = 0.18 + (runElapsed / 1000) * 0.22;
      figX = 145 + runElapsed * runSpeed;
      legCycle = runElapsed * 0.022; // running cadence
      hipY = 176 + Math.sin(legCycle * 2) * 3.5; // vertical running bounce
    }

    // Draw Dust particles
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

    dustParticles.forEach((d, idx) => {
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

    // 3. Draw Stick Figure
    const NEON_BODY = '#10b981';
    ctx.strokeStyle = NEON_BODY;
    applyGlow(ctx, NEON_GALLOWS_GLOW, 14);

    // Torso
    const neckY = hipY - torsoLen;
    const forwardTilt = isRunning ? 5 : 0;

    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(figX + forwardTilt, neckY);
    ctx.lineTo(figX, hipY);
    ctx.stroke();

    // Head
    const headCenterY = neckY - headRadius;
    ctx.beginPath();
    ctx.arc(figX + forwardTilt, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Happy smiling face (eyes + smile)
    ctx.fillStyle = NEON_BODY;
    ctx.beginPath();
    ctx.arc(figX + forwardTilt - 5, headCenterY - 3, 2, 0, Math.PI * 2);
    ctx.arc(figX + forwardTilt + 5, headCenterY - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(figX + forwardTilt, headCenterY + 2, 8, 0.15 * Math.PI, 0.85 * Math.PI, false);
    ctx.stroke();

    // Legs
    ctx.lineWidth = 3.5;
    if (!isRunning) {
      // Landing pose
      ctx.beginPath();
      ctx.moveTo(figX, hipY);
      ctx.lineTo(figX - 12, groundY);
      ctx.moveTo(figX, hipY);
      ctx.lineTo(figX + 12, groundY);
      ctx.stroke();
    } else {
      // Running legs (alternating sine wave)
      const leg1Angle = Math.sin(legCycle);
      const leg2Angle = Math.sin(legCycle + Math.PI);
      const legLen = 46;

      const foot1X = figX + Math.sin(leg1Angle) * 22;
      const foot1Y = Math.min(groundY, hipY + Math.cos(leg1Angle) * (legLen - 4) + 6);
      ctx.beginPath();
      ctx.moveTo(figX, hipY);
      ctx.lineTo(foot1X, foot1Y);
      ctx.stroke();

      const foot2X = figX + Math.sin(leg2Angle) * 22;
      const foot2Y = Math.min(groundY, hipY + Math.cos(leg2Angle) * (legLen - 4) + 6);
      ctx.beginPath();
      ctx.moveTo(figX, hipY);
      ctx.lineTo(foot2X, foot2Y);
      ctx.stroke();
    }

    // Arms
    const shoulderY = neckY + 10;
    if (!isRunning) {
      // Raised in victory!
      ctx.beginPath();
      ctx.moveTo(figX + forwardTilt, shoulderY);
      ctx.lineTo(figX - 18, shoulderY - 18);
      ctx.moveTo(figX + forwardTilt, shoulderY);
      ctx.lineTo(figX + 18, shoulderY - 18);
      ctx.stroke();
    } else {
      // Pumping arms
      const arm1Angle = Math.sin(legCycle + Math.PI);
      const arm2Angle = Math.sin(legCycle);
      const armLen = 26;

      ctx.beginPath();
      ctx.moveTo(figX + forwardTilt, shoulderY);
      ctx.lineTo(figX + forwardTilt + Math.sin(arm1Angle) * armLen + 4, shoulderY + Math.cos(arm1Angle) * 12);
      ctx.moveTo(figX + forwardTilt, shoulderY);
      ctx.lineTo(figX + forwardTilt + Math.sin(arm2Angle) * armLen + 4, shoulderY + Math.cos(arm2Angle) * 12);
      ctx.stroke();
    }

    clearGlow(ctx);
    ctx.restore();

    if (elapsed < DURATION) {
      activeSpecialAnimId = requestAnimationFrame(animate);
    } else {
      activeSpecialAnimId = null;
      if (thisAnimRoundToken === currentRoundToken) {
        callback();
      }
    }
  }

  activeSpecialAnimId = requestAnimationFrame(animate);
}

/**
 * triggerConfettiShower — Shoots a massive neon confetti shower across the screen.
 * Uses canvas-confetti CDN if available, or custom DOM particle fallback.
 */
function triggerConfettiShower() {
  const colors = ['#a855f7', '#7c3aed', '#06b6d4', '#22d3ee', '#10b981', '#34d399', '#f43f5e', '#facc15'];

  if (typeof window.confetti === 'function') {
    // Left bottom corner cannon
    window.confetti({
      particleCount: 65,
      angle: 60,
      spread: 75,
      origin: { x: 0.05, y: 0.9 },
      colors,
      zIndex: 9999
    });

    // Right bottom corner cannon
    window.confetti({
      particleCount: 65,
      angle: 120,
      spread: 75,
      origin: { x: 0.95, y: 0.9 },
      colors,
      zIndex: 9999
    });

    // Center ceiling celebration bursts over 2.5s
    const end = Date.now() + 2500;
    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      window.confetti({
        particleCount: 30,
        startVelocity: 25,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.1 },
        colors,
        zIndex: 9999
      });
    }, 250);
  } else {
    triggerFallbackConfetti();
  }
}

/**
 * Fallback DOM confetti generator in case CDN is unreachable
 */
function triggerFallbackConfetti() {
  const colors = ['#a855f7', '#7c3aed', '#06b6d4', '#22d3ee', '#10b981', '#34d399', '#f43f5e', '#facc15'];
  const count = 75;
  const container = document.body;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 6;
    const startX = Math.random() > 0.5 ? Math.random() * 20 : 80 + Math.random() * 20;

    el.style.cssText = `
      position: fixed;
      left: ${startX}vw;
      bottom: 5vh;
      width: ${size}px;
      height: ${size * 0.6}px;
      background: ${color};
      border-radius: 2px;
      z-index: 99999;
      pointer-events: none;
      box-shadow: 0 0 8px ${color};
      transition: all 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      opacity: 1;
      transform: translateY(0) rotate(0deg);
    `;
    container.appendChild(el);

    requestAnimationFrame(() => {
      const targetX = startX + (Math.random() * 40 - 20);
      const targetY = -(Math.random() * 70 + 40);
      const rot = Math.random() * 720 - 360;
      el.style.transform = `translate(${targetX - startX}vw, ${targetY}vh) rotate(${rot}deg)`;
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 1000);
      }, 1400);
    });
  }
}


// ─── Render Keyboard ──────────────────────────────────────────────────────────
function renderKeyboard(container, guessedLetters, wrongGuesses, interactive) {
  container.innerHTML = '';
  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    row.forEach(letter => {
      const btn = document.createElement('button');
      btn.className = 'key-btn';
      btn.textContent = letter;
      btn.setAttribute('aria-label', `Guess letter ${letter}`);
      const l = letter.toLowerCase();
      const isGuessed = guessedLetters.includes(l);
      const isWrong   = wrongGuesses.includes(l);
      if (isGuessed && !isWrong) btn.classList.add('correct');
      if (isWrong) btn.classList.add('wrong');
      if (interactive && !isGuessed) {
        btn.addEventListener('click', () => {
          if (isPveMode) {
            handlePveGuess(l);
          } else {
            socket.emit('guess_letter', { letter: l });
          }
        });
      } else {
        btn.disabled = true;
      }
      rowEl.appendChild(btn);
    });
    container.appendChild(rowEl);
  });
}

// ─── Render Word Display ──────────────────────────────────────────────────────
function renderWordDisplay(container, hiddenWord, newlyGuessedLetters = []) {
  container.innerHTML = '';
  const newSet = new Set(newlyGuessedLetters.map(l => l.toLowerCase()));

  hiddenWord.split('').forEach(ch => {
    if (ch === ' ') {
      const space = document.createElement('div');
      space.style.width = '1.2rem';
      container.appendChild(space);
      return;
    }
    const box = document.createElement('div');
    box.className = 'letter-box';

    const isBlank = ch === '_';
    const isNew = !isBlank && newSet.has(ch.toLowerCase());

    const charEl = document.createElement('span');
    charEl.className = 'letter-char' + (isBlank ? ' blank' : '') + (isNew ? ' letter-drop-in' : '');
    charEl.textContent = isBlank ? '_' : ch;

    const lineEl = document.createElement('div');
    lineEl.className = 'letter-line' + (!isBlank ? ' revealed' : '');

    box.appendChild(charEl);
    box.appendChild(lineEl);
    container.appendChild(box);
  });
}

// ─── Render Wrong Letters ─────────────────────────────────────────────────────
function renderWrongLetters(container, wrongGuesses, newlyWrongLetters = []) {
  container.innerHTML = '';
  const newWrongSet = new Set(newlyWrongLetters.map(l => l.toLowerCase()));

  wrongGuesses.forEach(l => {
    const chip = document.createElement('span');
    const isNew = newWrongSet.has(l.toLowerCase());
    chip.className = 'wrong-letter-chip' + (isNew ? ' new-wrong' : '');
    chip.textContent = l.toUpperCase();
    container.appendChild(chip);
  });
}

// ─── Update Lives Color ───────────────────────────────────────────────────────
function updateLivesColor(el, lives) {
  el.classList.remove('warn', 'danger');
  if (lives <= 3) el.classList.add('danger');
  else if (lives <= 6) el.classList.add('warn');
}


// ─── Hide All Game Panels ────────────────────────────────────────────────────
function hideAllPanels() {
  panelWordSetter.classList.add('hidden');
  panelGuesserWaiting.classList.add('hidden');
  panelGuesser.classList.add('hidden');
  panelWatching.classList.add('hidden');
  overlayRoundover.classList.add('hidden');
  overlayRoundover.classList.remove('loss-theme', 'win-theme', 'victory-theme', 'defeat-theme', 'guesser-victory-theme', 'setter-defeat-theme');
  stopFactsCycle();
  stopWatcherFactsCycle();
  const gameContainer = document.getElementById('screen-game') || document.body;
  if (gameContainer) {
    gameContainer.classList.remove('game-losing-shake', 'game-losing-flash');
  }
}

// ─── Setter Timer Ring ────────────────────────────────────────────────────────
function updateTimerRing(secondsLeft, total) {
  if (!setterTimerVal || !timerRingFill) return;
  const fraction = Math.max(0, secondsLeft / Math.max(1, total));
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  timerRingFill.style.strokeDashoffset = offset;
  setterTimerVal.textContent = secondsLeft;
  const isWarn   = secondsLeft <= 20 && secondsLeft > 10;
  const isDanger = secondsLeft <= 10;
  timerRingFill.classList.toggle('warn',   isWarn);
  timerRingFill.classList.toggle('danger', isDanger);
  setterTimerVal.classList.toggle('warn',   isWarn);
  setterTimerVal.classList.toggle('danger', isDanger);
}

// ─── Guesser Waiting Timer Bar ────────────────────────────────────────────────
function updateGwTimer(secondsLeft, total) {
  if (!gwTimerFill || !gwTimerVal) return;
  const pct = Math.max(0, (secondsLeft / Math.max(1, total)) * 100);
  gwTimerFill.style.width = pct + '%';
  gwTimerVal.textContent = secondsLeft + 's';
  const isWarn   = secondsLeft <= 20 && secondsLeft > 10;
  const isDanger = secondsLeft <= 10;
  gwTimerFill.classList.toggle('warn',   isWarn);
  gwTimerFill.classList.toggle('danger', isDanger);
  gwTimerVal.classList.toggle('warn',   isWarn);
  gwTimerVal.classList.toggle('danger', isDanger);
}

// ─── Word Suggestions with Definitions (Word Setter) ──────────────────────────
function renderWordSuggestions(suggestions = []) {
  if (!wordSuggestionsGrid) return;
  wordSuggestionsGrid.innerHTML = '';
  suggestions.forEach(item => {
    const word = (typeof item === 'string' ? item : item.word).toUpperCase();
    const meaning = (typeof item === 'object' && item.meaning) ? item.meaning : 'A valid English dictionary word.';

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'suggestion-card';
    card.setAttribute('aria-label', `Choose word ${word}: ${meaning}`);

    const wordEl = document.createElement('span');
    wordEl.className = 'suggestion-word';
    wordEl.textContent = word;

    const meaningEl = document.createElement('span');
    meaningEl.className = 'suggestion-meaning';
    meaningEl.textContent = meaning;

    card.appendChild(wordEl);
    card.appendChild(meaningEl);

    card.addEventListener('click', () => {
      document.querySelectorAll('.suggestion-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      inputWord.value = word.toLowerCase();
      inputWord.focus();
      btnSubmitWord.disabled = false;
      wordValidationMsg.classList.add('hidden');
    });

    wordSuggestionsGrid.appendChild(card);
  });
}

if (btnRefreshSuggestions) {
  btnRefreshSuggestions.addEventListener('click', () => {
    btnRefreshSuggestions.classList.add('spinning');
    socket.emit('get_suggestions');
    setTimeout(() => {
      btnRefreshSuggestions.classList.remove('spinning');
    }, 500);
  });
}

// Deselect cards if user types custom word
inputWord.addEventListener('input', () => {
  const val = inputWord.value.trim().toLowerCase();
  document.querySelectorAll('.suggestion-card').forEach(c => {
    const w = c.querySelector('.suggestion-word');
    c.classList.toggle('active', w && w.textContent.toLowerCase() === val);
  });
});

// ─── Random Facts Generator (Guesser Waiting & Setter Watching) ────────────────
const RANDOM_FACTS = [
  "The word 'Hangman' was first recorded in Victorian England in Alice Bertha Gomme's 1894 game book.",
  "'Rhythm' is the longest common English word without a standard vowel (A, E, I, O, U).",
  "The letter 'E' is the most frequently used letter in English, appearing in roughly 11% of words.",
  "The dot over the lower-case letters 'i' and 'j' is officially called a 'tittle'.",
  "'Uncopyrightable' is the longest English word that can be spelled without repeating any letter.",
  "The word 'set' has the highest number of definitions in the English dictionary (over 430!).",
  "A sentence that contains every letter of the alphabet is known as a 'pangram'.",
  "'Dreamt' is the only common English word that ends with the letters 'mt'.",
  "No common English words rhyme with month, orange, silver, or purple.",
  "The shortest complete grammatical sentence in the English language is 'I am.'",
  "'Typewriter' is one of the longest words you can write using only the top row of a standard keyboard.",
  "Shakespeare invented over 1,700 words, including 'lonely', 'swagger', 'eyeball', and 'gossip'.",
  "The word 'clue' originally meant a ball of thread used to navigate labyrinth mazes.",
  "The longest word in major English dictionaries is 45 letters: 'pneumonoultramicroscopicsilicovolcanoconiosis'.",
  "Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs that is still edible!",
  "Octopuses have three hearts, nine brains, and blue blood.",
  "Venus is the only planet in our solar system that spins clockwise.",
  "A group of flamingos is called a 'flamboyance', and a group of owls is called a 'parliament'."
];

let factsInterval = null;
let lastFactIdx = -1;

function getNextFact() {
  let idx;
  do {
    idx = Math.floor(Math.random() * RANDOM_FACTS.length);
  } while (idx === lastFactIdx && RANDOM_FACTS.length > 1);
  lastFactIdx = idx;
  return RANDOM_FACTS[idx];
}

function displayNextFact() {
  if (!randomFactText) return;
  randomFactText.classList.add('fact-fade-out');
  setTimeout(() => {
    randomFactText.textContent = getNextFact();
    randomFactText.classList.remove('fact-fade-out');
  }, 450);
}

function startFactsCycle() {
  if (factsInterval) return;
  if (randomFactText) {
    randomFactText.textContent = getNextFact();
    randomFactText.classList.remove('fact-fade-out');
  }
  factsInterval = setInterval(displayNextFact, 6000); // cycles smoothly every 6s
}

function stopFactsCycle() {
  if (factsInterval) {
    clearInterval(factsInterval);
    factsInterval = null;
  }
}

// ─── Watcher Facts Cycle (Word Setter during Game) ─────────────────────────────
let watcherFactsInterval = null;
let lastWatcherFactIdx = -1;

function getNextWatcherFact() {
  let idx;
  do {
    idx = Math.floor(Math.random() * RANDOM_FACTS.length);
  } while (idx === lastWatcherFactIdx && RANDOM_FACTS.length > 1);
  lastWatcherFactIdx = idx;
  return RANDOM_FACTS[idx];
}

function displayNextWatcherFact() {
  if (!randomFactWatch) return;
  randomFactWatch.classList.add('fact-fade-out');
  setTimeout(() => {
    randomFactWatch.textContent = getNextWatcherFact();
    randomFactWatch.classList.remove('fact-fade-out');
  }, 450);
}

function startWatcherFactsCycle() {
  if (watcherFactsInterval) return;
  if (randomFactWatch) {
    randomFactWatch.textContent = getNextWatcherFact();
    randomFactWatch.classList.remove('fact-fade-out');
  }
  watcherFactsInterval = setInterval(displayNextWatcherFact, 7000); // cycle every 7s
}

function stopWatcherFactsCycle() {
  if (watcherFactsInterval) {
    clearInterval(watcherFactsInterval);
    watcherFactsInterval = null;
  }
}

// ─── Particle Animation ───────────────────────────────────────────────────────
let particleAnimId = null;
const PARTICLE_COLORS = [
  'rgba(124,58,237,',
  'rgba(6,182,212,',
  'rgba(168,85,247,',
  'rgba(16,185,129,',
];

function startParticles() {
  if (!particleCanvas || particleAnimId) return;
  const W = particleCanvas.offsetWidth  || 620;
  const H = particleCanvas.offsetHeight || 500;
  particleCanvas.width  = W;
  particleCanvas.height = H;
  const count = Math.max(20, Math.floor((W * H) / 8000));
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1.5 + Math.random() * 3.5,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      alpha: 0.15 + Math.random() * 0.5,
    });
  }
  const ctx = particleCanvas.getContext('2d');
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle  = p.color + p.alpha + ')';
      ctx.shadowColor = p.color + '0.8)';
      ctx.shadowBlur  = p.r * 3;
      ctx.fill();
      ctx.shadowBlur = 0;
      p.x = (p.x + p.vx + W) % W;
      p.y = (p.y + p.vy + H) % H;
    }
    particleAnimId = requestAnimationFrame(draw);
  }
  draw();
}

function stopParticles() {
  if (particleAnimId) { cancelAnimationFrame(particleAnimId); particleAnimId = null; }
}

// ─── Text Scramble ────────────────────────────────────────────────────────────
const SCRAMBLE_PHRASES = [
  'PREPARING THE CHALLENGE',
  'WORD IS BEING CHOSEN',
  'GET READY TO GUESS',
  'STAND BY FOR THE WORD',
  'THE SETTER IS THINKING',
];
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%?&*';
let scrambleInterval = null;
let scramblePhraseIdx = 0;
let scrambleStep = 0;

function startScramble() {
  if (!scrambleEl || scrambleInterval) return;
  const phrase = SCRAMBLE_PHRASES[scramblePhraseIdx % SCRAMBLE_PHRASES.length];
  const len = phrase.length;
  scrambleStep = 0;
  scrambleInterval = setInterval(() => {
    if (scrambleStep <= len) {
      const revealed = phrase.slice(0, scrambleStep);
      const noise = Array.from({ length: Math.min(5, len - scrambleStep) })
        .map(() => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
        .join('');
      scrambleEl.textContent = revealed + noise;
      scrambleStep++;
    } else {
      clearInterval(scrambleInterval);
      scrambleInterval = null;
      scramblePhraseIdx++;
      // Chain next phrase — only if particles are still running (panel visible)
      setTimeout(() => { if (particleAnimId) startScramble(); }, 2400);
    }
  }, 55);
}

function stopScramble() {
  if (scrambleInterval) { clearInterval(scrambleInterval); scrambleInterval = null; }
  if (scrambleEl) scrambleEl.textContent = '';
}

// ─── Guesser Waiting Panel ────────────────────────────────────────────────────
function showGuesserWaiting(secondsLeft, total) {
  panelGuesserWaiting.classList.remove('hidden');
  startParticles();
  startScramble();
  startFactsCycle();
  updateGwTimer(secondsLeft, total);
}

function hideGuesserWaiting() {
  panelGuesserWaiting.classList.add('hidden');
  stopParticles();
  stopScramble();
  stopFactsCycle();
}


// ─── Main State Renderer ──────────────────────────────────────────────────────
function applyState(state) {
  const { state: gameState, players, game, roomCode } = state;

  myRoomCode = roomCode;

  // Update scoreboard
  if (players && players.length >= 1) {
    scoreNameP1.textContent = players[0].name;
    scoreValP1.textContent  = players[0].score;
  }
  if (players && players.length >= 2) {
    scoreNameP2.textContent = players[1].name;
    scoreValP2.textContent  = players[1].score;
  }
  headerRoomCode.textContent = `Room: ${roomCode}`;

  // ── LOBBY (waiting for opponent) ────────────────────────────────────────────
  if (gameState === 'lobby') {
    displayRoomCode.textContent = roomCode;
    showScreen('waiting');
    return;
  }

  showScreen('game');
  hideAllPanels();

  const myPlayer = players.find(p => p.isYou);
  const isWordSetter = game && game.isWordSetter;

  // ── SETTING WORD ────────────────────────────────────────────────────────────
  if (gameState === 'setting') {
    prevGuessedLetters = [];
    prevWrongGuesses = [];

    const sl  = (state.timerSecondsLeft != null) ? state.timerSecondsLeft : 60;
    const tot = state.timerTotal || 60;

    if (isWordSetter) {
      roleBanner.textContent = '\uD83D\uDD24 Your turn to set the word!';
      panelWordSetter.classList.remove('hidden');
      panelWordSetter.querySelector('.panel-card').style.opacity = '1';
      // Only reset the form if the setter hasn't submitted yet
      if (setterWaitingMsg.classList.contains('hidden')) {
        inputWord.value = '';
        btnSubmitWord.disabled = false;
        wordValidationMsg.classList.add('hidden');
        document.querySelectorAll('.suggestion-card').forEach(c => c.classList.remove('active'));
      }
      // Fetch suggestions if not already loaded
      if (wordSuggestionsGrid && !wordSuggestionsGrid.children.length) {
        socket.emit('get_suggestions');
      }
      // Sync the countdown ring to server time
      updateTimerRing(sl, tot);
    } else {
      roleBanner.textContent = '\u23F3 Waiting for the Word Setter\u2026';
      // Show the rich guesser-waiting panel (not the empty game board)
      showGuesserWaiting(sl, tot);
    }
    return;
  }


  // ── GUESSING PHASE ──────────────────────────────────────────────────────────
  if (gameState === 'guessing') {
    if (!game) return;

    const newlyGuessed = (game.guessedLetters || []).filter(l => !prevGuessedLetters.includes(l));
    const newlyWrong   = (game.wrongGuesses || []).filter(l => !prevWrongGuesses.includes(l));
    prevGuessedLetters = [...(game.guessedLetters || [])];
    prevWrongGuesses   = [...(game.wrongGuesses || [])];

    if (!isWordSetter) {
      // ── GUESSER VIEW ──────────────────────────────────────────────────────
      stopWatcherFactsCycle();
      roleBanner.textContent = '🔍 Your turn to guess!';
      panelGuesser.classList.remove('hidden');

      renderWordDisplay(wordDisplayEl, game.hiddenWord, newlyGuessed);
      renderKeyboard(keyboardEl, game.guessedLetters, game.wrongGuesses, true);
      livesLeftEl.textContent = game.livesLeft;
      updateLivesColor(livesLeftEl, game.livesLeft);
      renderWrongLetters(wrongLettersEl, game.wrongGuesses, newlyWrong);
      drawHangman(hangmanCanvas, game.livesLeft, game.maxLives);

    } else {
      // ── SETTER (WATCHER) VIEW ─────────────────────────────────────────────
      startWatcherFactsCycle();
      roleBanner.textContent = '👁 You set the word — watch them guess!';
      panelWatching.classList.remove('hidden');

      renderWordDisplay(wordDisplayWatch, game.hiddenWord, newlyGuessed);
      if (keyboardWatch) keyboardWatch.style.display = 'none';
      livesLeftWatch.textContent = game.livesLeft;
      updateLivesColor(livesLeftWatch, game.livesLeft);
      renderWrongLetters(wrongLettersWatch, game.wrongGuesses, newlyWrong);
      drawHangman(hangmanCanvasWatch, game.livesLeft, game.maxLives);

      if (game.word) {
        yourWordReveal.classList.remove('hidden');
        yourWordReveal.innerHTML = `Your word: <strong>${game.word}</strong>`;
      }
    }
    return;
  }

  // ── ROUND OVER ──────────────────────────────────────────────────────────────
  if (gameState === 'roundover') {
    stopWatcherFactsCycle();
    if (!game) return;

    const setterWins = game.roundResult === 'setter_wins';
    const guesserWon = game.roundResult === 'guesser_wins';

    // Render background panels (same as guessing, but keyboards locked)
    if (!isWordSetter) {
      panelGuesser.classList.remove('hidden');
      renderWordDisplay(wordDisplayEl, game.hiddenWord);
      renderKeyboard(keyboardEl, game.guessedLetters, game.wrongGuesses, false);
      livesLeftEl.textContent = game.livesLeft;
      renderWrongLetters(wrongLettersEl, game.wrongGuesses);
      if (!guesserWon) {
        drawHangman(hangmanCanvas, game.livesLeft, game.maxLives);
      }
    } else {
      panelWatching.classList.remove('hidden');
      renderWordDisplay(wordDisplayWatch, game.hiddenWord);
      if (keyboardWatch) keyboardWatch.style.display = 'none';
      livesLeftWatch.textContent = game.livesLeft;
      renderWrongLetters(wrongLettersWatch, game.wrongGuesses);
      if (!guesserWon) {
        drawHangman(hangmanCanvasWatch, game.livesLeft, game.maxLives);
      }
    }

    // ── 1. Accurately Resolve Distinct Setter & Guesser Usernames ─────────────
    let setterName = 'Word Setter';
    let guesserName = 'Guesser';

    if (isPveMode) {
      setterName = 'Computer 🤖';
      guesserName = (players && players[0] && players[0].name) || 'You';
    } else {
      if (game.setterName) setterName = game.setterName;
      if (game.guesserName) guesserName = game.guesserName;

      if (players && players.length >= 2) {
        const pSetter = players.find(p => p.id === game.wordSetterId);
        const pGuesser = players.find(p => p.id === game.guesserId || (p.id && p.id !== game.wordSetterId));
        if (pSetter) setterName = pSetter.name;
        if (pGuesser) guesserName = pGuesser.name;
      }
    }

    // Determine local player's role
    const amIWordSetter = Boolean(isPveMode ? false : (game.isWordSetter !== undefined ? game.isWordSetter : isWordSetter));

    // Clear previous themes
    overlayRoundover.classList.remove('loss-theme', 'win-theme', 'victory-theme', 'defeat-theme', 'guesser-victory-theme', 'setter-defeat-theme');

    // ── 2. POV-Specific Modal Themes & Copy ─────────────────────────────────────
    if (setterWins) {
      // The Setter won (Guesser made 10 mistakes / hanged)
      if (amIWordSetter) {
        // Local player is the triumphant Word Setter
        overlayRoundover.classList.add('victory-theme');
        roundoverIcon.textContent = '🏆';
        roundoverTitle.textContent = 'Execution Successful! 💀';
        roundoverSubtitle.textContent = `Your word stumped ${guesserName}!`;
      } else {
        // Local player is the defeated Guesser
        overlayRoundover.classList.add('defeat-theme');
        roundoverIcon.textContent = '☠️';
        roundoverTitle.textContent = 'You Were Hanged! ☠️';
        roundoverSubtitle.textContent = `${setterName}'s word stumped ${isPveMode ? 'you' : guesserName}!`;
      }
    } else if (guesserWon) {
      // Calculate mistakes made by the Guesser
      const mistakesMade = (game.wrongGuesses && Array.isArray(game.wrongGuesses))
        ? game.wrongGuesses.length
        : Math.max(0, (game.maxLives || 10) - (game.livesLeft !== undefined ? game.livesLeft : 10));

      if (!amIWordSetter) {
        // Local player is the triumphant Guesser
        overlayRoundover.classList.add('guesser-victory-theme', 'victory-theme');
        roundoverIcon.textContent = mistakesMade === 0 ? '👑' : (mistakesMade >= 7 ? '😅' : '🎉');
        roundoverTitle.textContent = getRandomPerformanceDialogue(mistakesMade, true);
        roundoverSubtitle.textContent = isPveMode
          ? "You figured out Computer's word!"
          : `${guesserName} figured out ${setterName}'s word!`;
      } else {
        // Local player is the defeated Word Setter
        overlayRoundover.classList.add('setter-defeat-theme', 'defeat-theme');
        roundoverIcon.textContent = mistakesMade >= 7 ? '💔' : '🏃💨';
        roundoverTitle.textContent = getRandomPerformanceDialogue(mistakesMade, false);
        roundoverSubtitle.textContent = `${guesserName} figured out your word!`;
      }
    }

    // ── 3. Staggered / Unlocked Color-Coded Word Reveal Animation ───────────────
    if (game.word) {
      roundoverWord.innerHTML = '';
      const cleanWord = game.word.toUpperCase();
      const guessedSet = new Set((game.guessedLetters || []).map(l => l.toUpperCase()));

      cleanWord.split('').forEach((ch, idx) => {
        const span = document.createElement('span');
        span.textContent = ch;
        span.style.setProperty('--index', idx);

        if (guesserWon) {
          if (!amIWordSetter) {
            // Winning Guesser: Unlocked flashing pop
            span.className = 'word-letter-span word-letter-unlocked';
          } else {
            // Losing Setter: Flat, non-glowing exposed slate
            span.className = 'word-letter-span word-letter-exposed';
          }
        } else {
          // Setter won (Guesser failed)
          if (guessedSet.has(ch)) {
            span.className = 'word-letter-span word-letter-guessed';
          } else {
            span.className = 'word-letter-span word-letter-missed';
          }
        }

        roundoverWord.appendChild(span);
      });
    } else {
      roundoverWord.textContent = '';
    }

    // ── 4. Context-Aware Button Logic (Single-Player vs Multiplayer) ─────────────
    if (isPveMode) {
      btnNextRound.textContent = 'Play Again ↻';
      btnNextRound.setAttribute('aria-label', 'Play another round against the computer');
    } else {
      btnNextRound.textContent = 'Next Round ↩ Swap Roles';
      btnNextRound.setAttribute('aria-label', 'Start next round and swap roles');
    }

    roundoverScores.innerHTML = players.map(p => `
      <div class="rs-player">
        <span class="rs-name">${p.name}${p.isYou ? ' (You)' : ''}</span>
        <span class="rs-score">${p.score}</span>
      </div>
    `).join('<div class="rs-divider">:</div>');

    currentRoundToken++;
    const thisRoundToken = currentRoundToken;

    // ── Show overlay callback (guarded by round token) ───
    const showOverlay = () => {
      if (thisRoundToken === currentRoundToken && overlayRoundover) {
        overlayRoundover.classList.remove('hidden');
      }
    };

    if (setterWins) {
      // 1. Environmental Screen Shake and Red Flash
      const gameContainer = document.getElementById('screen-game') || document.body;
      gameContainer.classList.remove('game-losing-shake', 'game-losing-flash');
      void gameContainer.offsetWidth; // Force CSS reflow
      gameContainer.classList.add('game-losing-shake', 'game-losing-flash');
      setTimeout(() => {
        gameContainer.classList.remove('game-losing-shake');
      }, 550);

      // 2. Play "Game Over" trapdoor drop and pendulum swinging hanging animation & delay modal
      const activeCanvas = !isWordSetter ? hangmanCanvas : hangmanCanvasWatch;
      triggerDeathAnimation(activeCanvas, showOverlay);
    } else if (guesserWon) {
      // 1. Fire massive neon confetti shower ONLY for winning Guesser
      if (!amIWordSetter) {
        triggerConfettiShower();
      }
      // 2. Play "The Great Escape" canvas running animation & delay modal
      const activeCanvas = !isWordSetter ? hangmanCanvas : hangmanCanvasWatch;
      triggerEscapeAnimation(activeCanvas, game.livesLeft, game.maxLives, showOverlay);
    } else {
      showOverlay();
    }
  }
}

// ─── Socket Events ────────────────────────────────────────────────────────────

socket.on('room_created', ({ roomCode }) => {
  myRoomCode = roomCode;
  displayRoomCode.textContent = roomCode;
  showScreen('waiting');
});

socket.on('state_update', (state) => {
  applyState(state);
});

// Server authority: Forcefully close Game Over modal and reset canvas for new guessing phase
socket.on('round_started', () => {
  currentRoundToken++;
  forceCloseGameOverModal();
  prevGuessedLetters = [];
  prevWrongGuesses = [];
  const s1 = getCanvasAnimState(hangmanCanvas);
  if (s1.animId) cancelAnimationFrame(s1.animId);
  s1.drawnSteps = 0;
  s1.animId = null;
  const s2 = getCanvasAnimState(hangmanCanvasWatch);
  if (s2.animId) cancelAnimationFrame(s2.animId);
  s2.drawnSteps = 0;
  s2.animId = null;
  const ctx1 = hangmanCanvas.getContext('2d');
  ctx1.clearRect(0, 0, hangmanCanvas.width, hangmanCanvas.height);
  const ctx2 = hangmanCanvasWatch.getContext('2d');
  ctx2.clearRect(0, 0, hangmanCanvasWatch.width, hangmanCanvasWatch.height);
});

// Server authority: Forcefully close Game Over modal on role-swap / setting transition
socket.on('round_transitioning', () => {
  currentRoundToken++;
  forceCloseGameOverModal();
  prevGuessedLetters = [];
  prevWrongGuesses = [];
  const s1 = getCanvasAnimState(hangmanCanvas);
  if (s1.animId) cancelAnimationFrame(s1.animId);
  s1.drawnSteps = 0;
  s1.animId = null;
  const s2 = getCanvasAnimState(hangmanCanvasWatch);
  if (s2.animId) cancelAnimationFrame(s2.animId);
  s2.drawnSteps = 0;
  s2.animId = null;
  const ctx1 = hangmanCanvas.getContext('2d');
  ctx1.clearRect(0, 0, hangmanCanvas.width, hangmanCanvas.height);
  const ctx2 = hangmanCanvasWatch.getContext('2d');
  ctx2.clearRect(0, 0, hangmanCanvasWatch.width, hangmanCanvasWatch.height);
});

socket.on('word_suggestions', ({ suggestions }) => {
  renderWordSuggestions(suggestions);
});

socket.on('word_validation', ({ valid, reason }) => {
  wordValidationMsg.classList.remove('hidden', 'checking', 'error', 'success');

  if (valid === null) {
    // Still checking
    wordValidationMsg.classList.add('checking');
    wordValidationMsg.textContent = reason;
    return;
  }

  if (!valid) {
    wordValidationMsg.classList.add('error');
    wordValidationMsg.textContent = reason;
    btnSubmitWord.disabled = false;
  } else {
    wordValidationMsg.classList.add('success');
    wordValidationMsg.textContent = '✅ Word accepted! Waiting for guesser…';
    setterWaitingMsg.classList.remove('hidden');
    panelWordSetter.querySelector('.panel-card').style.opacity = '0.5';
  }
});

socket.on('error_msg', (msg) => {
  showToast(`⚠️ ${msg}`, 3000);
  // If it's lobby-related
  if (screens.lobby.classList.contains('active')) {
    showLobbyError(msg);
  }
  // Re-enable submit button if word submission failed
  if (btnSubmitWord.disabled) {
    btnSubmitWord.disabled = false;
  }
});

socket.on('opponent_left', () => {
  showToast('⚠️ Your opponent left the game.', 4000);
  // The state_update will switch back to lobby/waiting
});

socket.on('disconnect', () => {
  showToast('⚡ Disconnected from server. Refresh to reconnect.', 5000);
});

socket.on('connect', () => {
  // Reconnected — show lobby
  if (!myRoomCode) showScreen('lobby');
});

// ─── Timer Events ─────────────────────────────────────────────────────────────

socket.on('timer_tick', ({ secondsLeft, total }) => {
  timerState = { secondsLeft, total };

  // Update setter ring (only visible when setter panel is shown)
  if (!panelWordSetter.classList.contains('hidden')) {
    updateTimerRing(secondsLeft, total);
  }
  // Update guesser waiting bar (only visible when guesser waiting panel shown)
  if (!panelGuesserWaiting.classList.contains('hidden')) {
    updateGwTimer(secondsLeft, total);
  }
});

socket.on('timer_expired', ({ word }) => {
  showToast('\u23F1 Time\u2019s up! Server picked the word automatically.', 4000);
  // Stop the guesser waiting animation — state_update will handle transitioning
  hideGuesserWaiting();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
showScreen('lobby');
inputName.focus();

