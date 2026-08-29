const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// ─── CORS Allowed Origins ──────────────────────────────────────────────────────
// In production on Render, set the ALLOWED_ORIGINS env var to your Vercel URL,
// e.g. "https://your-hangman-app.vercel.app" (comma-separated for multiple).
// Both http://localhost:3000 and http://localhost:3001 are always allowed for local dev.
const PROD_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  ...PROD_ORIGINS,
];

// ─── Local Dictionary Initialization (O(1) Memory Lookups) ────────────────────
const DICTIONARY_SET = new Set();
const DICTIONARY_ENTRIES = []; // Array of { word, meaning }

// 1. Load curated definitions list for suggestions and PvE mode
try {
  const dictPath = path.join(__dirname, 'dictionary.json');
  if (fs.existsSync(dictPath)) {
    const rawData = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    rawData.forEach(item => {
      if (typeof item === 'string') {
        const clean = item.toLowerCase().trim();
        DICTIONARY_SET.add(clean);
        DICTIONARY_ENTRIES.push({
          word: clean.toUpperCase(),
          meaning: 'A valid English dictionary word.'
        });
      } else if (item && item.word) {
        const clean = item.word.toLowerCase().trim();
        const meaning = item.meaning || 'A valid English dictionary word.';
        DICTIONARY_SET.add(clean);
        DICTIONARY_ENTRIES.push({
          word: item.word.toUpperCase(),
          meaning: meaning
        });
      }
    });
  }
} catch (err) {
  console.error('Warning loading dictionary.json:', err.message);
}

// 2. Load comprehensive English dictionary (275,000+ words) for full vocabulary coverage
try {
  const englishWords = require('an-array-of-english-words');
  if (Array.isArray(englishWords)) {
    englishWords.forEach(w => {
      if (typeof w === 'string') {
        DICTIONARY_SET.add(w.toLowerCase().trim());
      }
    });
  }
  console.log(`📚 Comprehensive English Dictionary loaded: ${DICTIONARY_SET.size} words in memory (O(1) lookups active).`);
} catch (err) {
  console.log(`ℹ️ Curated dictionary loaded with ${DICTIONARY_SET.size} words.`);
}

// ─── Room Store & Constants ────────────────────────────────────────────────────
const rooms = {};
const MAX_LIVES = 10;
const DEFAULT_WORD_PICK_TIME = 60; // seconds

function getRandomWord(difficulty = 'medium') {
  let filtered = DICTIONARY_ENTRIES;
  if (difficulty === 'easy') {
    filtered = DICTIONARY_ENTRIES.filter(e => e.word.length >= 4 && e.word.length <= 5);
  } else if (difficulty === 'medium') {
    filtered = DICTIONARY_ENTRIES.filter(e => e.word.length >= 6 && e.word.length <= 8);
  } else if (difficulty === 'hard') {
    filtered = DICTIONARY_ENTRIES.filter(e => e.word.length >= 9);
  }
  if (!filtered.length) filtered = DICTIONARY_ENTRIES;
  const entry = filtered[Math.floor(Math.random() * filtered.length)];
  return entry ? entry.word.toLowerCase() : 'hangman';
}

function getRandomSuggestions(count = 12) {
  const selectedMap = new Map();
  let attempts = 0;
  while (selectedMap.size < count && attempts < 250) {
    attempts++;
    const entry = DICTIONARY_ENTRIES[Math.floor(Math.random() * DICTIONARY_ENTRIES.length)];
    if (entry && !selectedMap.has(entry.word)) {
      selectedMap.set(entry.word, entry);
    }
  }
  return Array.from(selectedMap.values());
}

// Instant O(1) Dictionary Validation
function isValidWord(word) {
  if (!word || word.length < 2) return false;
  const clean = word.toLowerCase().trim();
  if (!/^[a-z]+$/.test(clean)) return false;
  return DICTIONARY_SET.has(clean);
}

// Helpers
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getHiddenWord(word, guessed) {
  return word.split('').map(ch => (guessed.includes(ch) ? ch : '_')).join('');
}

function findPlayer(room, socketId) {
  return room.players.find(p => p.id === socketId);
}

// Timer management
function stopSettingTimer(roomCode) {
  const room = rooms[roomCode];
  if (!room || !room.timer) return;
  if (room.timer.interval) {
    clearInterval(room.timer.interval);
    room.timer.interval = null;
  }
  room.timer = null;
}

function startSettingTimer(io, roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  stopSettingTimer(roomCode);

  const total = (room.settings && room.settings.wordPickTime) || DEFAULT_WORD_PICK_TIME;
  room.timer = { secondsLeft: total, total, interval: null };

  io.to(roomCode).emit('timer_tick', { secondsLeft: total, total });

  room.timer.interval = setInterval(() => {
    if (!rooms[roomCode] || !rooms[roomCode].timer) return;

    rooms[roomCode].timer.secondsLeft--;
    const left = rooms[roomCode].timer.secondsLeft;

    io.to(roomCode).emit('timer_tick', { secondsLeft: left, total });

    if (left <= 0) {
      stopSettingTimer(roomCode);
      if (!rooms[roomCode] || rooms[roomCode].state !== 'setting') return;

      // Auto-select a random word from the fast local dictionary
      const word = getRandomWord();
      rooms[roomCode].game.word = word;
      rooms[roomCode].state = 'guessing';

      // Notify both players before broadcasting state
      io.to(roomCode).emit('timer_expired', { word });
      io.to(roomCode).emit('round_started', {
        wordLength: word.length,
        wordSetterId: rooms[roomCode].game.wordSetterId,
        guesserId: rooms[roomCode].game.guesserId
      });
      broadcastState(io, rooms[roomCode], roomCode);
      console.log(`⏱ Timer expired for room ${roomCode}. Auto-word: "${word}"`);
    }
  }, 1000);
}

// Broadcast state
function broadcastState(io, room, roomCode) {
  const timerSecondsLeft = room.timer ? room.timer.secondsLeft : null;
  const timerTotal = (room.settings && room.settings.wordPickTime) || DEFAULT_WORD_PICK_TIME;

  room.players.forEach(player => {
    const isWordSetter = room.game && room.game.wordSetterId === player.id;
    const setterPlayer = room.players.find(p => p.id === (room.game && room.game.wordSetterId));
    const guesserPlayer = room.players.find(p => p.id === (room.game && room.game.guesserId));

    const payload = {
      state: room.state,
      players: room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isYou: p.id === player.id
      })),
      settings: room.settings || { wordPickTime: DEFAULT_WORD_PICK_TIME },
      timerSecondsLeft,
      timerTotal,
      game: room.game ? {
        wordLength: room.game.word ? room.game.word.length : 0,
        hiddenWord: room.game.word ? getHiddenWord(room.game.word, room.game.guessedLetters) : '',
        guessedLetters: room.game.guessedLetters,
        livesLeft: room.game.livesLeft,
        maxLives: MAX_LIVES,
        wordSetterId: room.game.wordSetterId,
        guesserId: room.game.guesserId,
        setterName: setterPlayer ? setterPlayer.name : 'Word Setter',
        guesserName: guesserPlayer ? guesserPlayer.name : 'Guesser',
        isWordSetter,
        word: (isWordSetter || room.state === 'roundover') ? room.game.word : null,
        roundResult: room.game.roundResult || null,
        wrongGuesses: room.game.wrongGuesses || []
      } : null,
      roomCode
    };

    io.to(player.id).emit('state_update', payload);
  });
}

// ─── Start Standalone Socket.io + Express Server ──────────────────────────────
// This file is the pure backend — it has NO dependency on Next.js.
// The Next.js frontend is deployed separately on Vercel.
(function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no Origin header (e.g. server-to-server, Render health checks)
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        const isAllowed = ALLOWED_ORIGINS.some(
          (o) => o === '*' || o.replace(/\/$/, '') === cleanOrigin
        );
        if (isAllowed) return callback(null, true);
        console.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error(`CORS policy: origin "${origin}" not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Health-check endpoint (required by Render free tier to keep the service alive)
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'hangman-socket-server', uptime: process.uptime() });
  });

  // REST endpoint for dictionary
  app.get('/api/dictionary', (req, res) => {
    res.json(DICTIONARY_ENTRIES);
  });

  // Socket.io Handlers
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // ── Create Room ──────────────────────────────────────────────────────────
    socket.on('create_room', ({ playerName, wordPickTime }) => {
      if (!playerName || !playerName.trim()) {
        socket.emit('error_msg', 'Please enter your name.');
        return;
      }
      let roomCode;
      do { roomCode = generateRoomCode(); } while (rooms[roomCode]);

      const validTimes = [30, 60, 90, 120];
      const pickedTime = validTimes.includes(Number(wordPickTime))
        ? Number(wordPickTime)
        : DEFAULT_WORD_PICK_TIME;

      rooms[roomCode] = {
        state: 'lobby',
        players: [{ id: socket.id, name: playerName.trim(), score: 0 }],
        game: null,
        timer: null,
        settings: { wordPickTime: pickedTime }
      };

      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerName = playerName.trim();

      socket.emit('room_created', { roomCode });
      broadcastState(io, rooms[roomCode], roomCode);
      console.log(`Room ${roomCode} created by ${playerName} (timer: ${pickedTime}s)`);
    });

    // ── Join Room ─────────────────────────────────────────────────────────────
    socket.on('join_room', ({ roomCode, playerName }) => {
      const code = (roomCode || '').toUpperCase().trim();
      if (!playerName || !playerName.trim()) {
        socket.emit('error_msg', 'Please enter your name.');
        return;
      }
      if (!rooms[code]) {
        socket.emit('error_msg', 'Room not found. Check the code and try again.');
        return;
      }
      const room = rooms[code];
      if (room.players.length >= 2) {
        socket.emit('error_msg', 'Room is full (2 players max).');
        return;
      }
      if (room.state !== 'lobby') {
        socket.emit('error_msg', 'Game already in progress.');
        return;
      }

      room.players.push({ id: socket.id, name: playerName.trim(), score: 0 });
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerName = playerName.trim();

      // Auto-start: Host (players[0]) is Word Setter, Joiner (players[1]) is Guesser
      room.state = 'setting';
      room.game = {
        word: null,
        wordSetterId: room.players[0].id,
        guesserId: room.players[1].id,
        guessedLetters: [],
        wrongGuesses: [],
        livesLeft: MAX_LIVES,
        roundResult: null
      };

      // ── CRITICAL: Emit game_start to the ENTIRE room so both players
      //    (Host who is stuck on the waiting screen AND the Joiner)
      //    simultaneously transition out of the lobby at the same instant.
      io.to(code).emit('game_start', {
        roomCode: code,
        wordSetterId: room.game.wordSetterId,
        guesserId: room.game.guesserId,
        players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
      });

      // Now broadcast the full state so both clients render the correct POV panel
      broadcastState(io, room, code);
      startSettingTimer(io, code);

      // Send word suggestions only to the Word Setter
      io.to(room.game.wordSetterId).emit('word_suggestions', {
        suggestions: getRandomSuggestions(12)
      });

      console.log(`${playerName} joined room ${code} — game_start emitted to both players.`);
    });

    // ── Word Suggestions Request ──────────────────────────────────────────────
    socket.on('get_suggestions', () => {
      socket.emit('word_suggestions', {
        suggestions: getRandomSuggestions(12)
      });
    });

    // ── Word Setter Submits Word ──────────────────────────────────────────────
    socket.on('set_word', ({ word }) => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      const room = rooms[roomCode];

      if (room.state !== 'setting') {
        socket.emit('error_msg', 'Not the right time to set a word.');
        return;
      }
      if (room.game.wordSetterId !== socket.id) {
        socket.emit('error_msg', 'Only the Word Setter can submit a word.');
        return;
      }

      const clean = (word || '').toLowerCase().trim();
      if (!clean || !/^[a-z]+$/.test(clean)) {
        socket.emit('word_validation', { valid: false, reason: 'Word must contain only letters.' });
        return;
      }
      if (clean.length < 2) {
        socket.emit('word_validation', { valid: false, reason: 'Word must be at least 2 letters.' });
        return;
      }

      // Instant O(1) local dictionary lookup
      const valid = isValidWord(clean);
      if (!valid) {
        socket.emit('word_validation', { valid: false, reason: `"${clean}" is not in the English dictionary.` });
        return;
      }

      stopSettingTimer(roomCode);
      socket.emit('word_validation', { valid: true, reason: '' });

      room.game.word = clean;
      room.state = 'guessing';
      broadcastState(io, room, roomCode);

      // Explicit round_started event broadcast to all clients in room (anti-softlock)
      io.to(roomCode).emit('round_started', {
        wordLength: clean.length,
        wordSetterId: room.game.wordSetterId,
        guesserId: room.game.guesserId
      });
    });

    // ── Guesser Guesses a Letter ──────────────────────────────────────────────
    socket.on('guess_letter', ({ letter }) => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      const room = rooms[roomCode];

      if (room.state !== 'guessing') {
        socket.emit('error_msg', 'No active guessing phase.');
        return;
      }
      if (room.game.guesserId !== socket.id) {
        socket.emit('error_msg', 'Only the Guesser can guess letters.');
        return;
      }

      const l = (letter || '').toLowerCase();
      if (!/^[a-z]$/.test(l)) return;
      if (room.game.guessedLetters.includes(l)) {
        socket.emit('error_msg', `You already guessed "${l.toUpperCase()}".`);
        return;
      }

      room.game.guessedLetters.push(l);

      if (!room.game.word.includes(l)) {
        room.game.livesLeft--;
        room.game.wrongGuesses.push(l);
      }

      const hidden = getHiddenWord(room.game.word, room.game.guessedLetters);
      if (!hidden.includes('_')) {
        const guesser = findPlayer(room, room.game.guesserId);
        if (guesser) guesser.score++;
        room.game.roundResult = 'guesser_wins';
        room.state = 'roundover';
      } else if (room.game.livesLeft <= 0) {
        const setter = findPlayer(room, room.game.wordSetterId);
        if (setter) setter.score++;
        room.game.roundResult = 'setter_wins';
        room.state = 'roundover';
      }

      broadcastState(io, room, roomCode);
    });

    // ── Next Round ────────────────────────────────────────────────────────────
    socket.on('next_round', () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      const room = rooms[roomCode];

      if (room.state !== 'roundover') return;

      const prevSetter = room.game.wordSetterId;
      const prevGuesser = room.game.guesserId;

      room.state = 'setting';
      room.game = {
        word: null,
        wordSetterId: prevGuesser, // swap roles
        guesserId: prevSetter,
        guessedLetters: [],
        wrongGuesses: [],
        livesLeft: MAX_LIVES,
        roundResult: null
      };

      broadcastState(io, room, roomCode);
      startSettingTimer(io, roomCode);

      // Notify both players to immediately clear previous roundover state and transition
      io.to(roomCode).emit('round_transitioning', {
        state: 'setting',
        wordSetterId: room.game.wordSetterId
      });

      // Send suggestions to new word setter
      io.to(room.game.wordSetterId).emit('word_suggestions', {
        suggestions: getRandomSuggestions(12)
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const roomCode = socket.data.roomCode;
      if (!roomCode || !rooms[roomCode]) return;
      const room = rooms[roomCode];

      stopSettingTimer(roomCode);
      room.players = room.players.filter(p => p.id !== socket.id);

      if (room.players.length === 0) {
        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted (empty).`);
      } else {
        room.state = 'lobby';
        room.game = null;
        io.to(room.players[0].id).emit('opponent_left');
        broadcastState(io, room, roomCode);
        console.log(`Player left room ${roomCode}. Waiting for new opponent.`);
      }
    });
  });


  const PORT = process.env.PORT || 3001;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`\n🎮  Hangman Socket.io Backend ready on http://localhost:${PORT}`);
    console.log(`    Allowed CORS origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
  });
})();
