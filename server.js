const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// ─── Environment & CORS Configuration ──────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// Allowed frontend origins (Vercel production domain + local dev)
const ALLOWED_ORIGINS = [
  'https://hangmanduel.makxxglobal.cloud',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim().replace(/\/$/, '')) : [])
];

// ─── Local Dictionary Initialization (O(1) Set Lookups) ────────────────────────
const DICTIONARY_SET = new Set();
const DICTIONARY_ENTRIES = []; // Array of { word, meaning }

// 1. Load curated definitions list for word suggestions & PvE
try {
  const dictPath = path.join(__dirname, 'dictionary.json');
  if (fs.existsSync(dictPath)) {
    const rawData = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    rawData.forEach((item) => {
      if (typeof item === 'string') {
        const clean = item.toLowerCase().trim();
        DICTIONARY_SET.add(clean);
        DICTIONARY_ENTRIES.push({
          word: clean.toUpperCase(),
          meaning: 'A valid English dictionary word.',
        });
      } else if (item && item.word) {
        const clean = item.word.toLowerCase().trim();
        const meaning = item.meaning || 'A valid English dictionary word.';
        DICTIONARY_SET.add(clean);
        DICTIONARY_ENTRIES.push({
          word: item.word.toUpperCase(),
          meaning: meaning,
        });
      }
    });
  }
} catch (err) {
  console.warn('⚠️ Notice loading dictionary.json:', err.message);
}

// 2. Load comprehensive English dictionary (275,000+ words)
try {
  const englishWords = require('an-array-of-english-words');
  if (Array.isArray(englishWords)) {
    englishWords.forEach((w) => {
      if (typeof w === 'string') {
        DICTIONARY_SET.add(w.toLowerCase().trim());
      }
    });
  }
  console.log(`📚 Dictionary loaded: ${DICTIONARY_SET.size} words in memory (O(1) lookups active).`);
} catch (err) {
  console.log(`ℹ️ Curated dictionary loaded with ${DICTIONARY_SET.size} words.`);
}

// ─── Room Store & Game Constants ───────────────────────────────────────────────
const rooms = {};
const MAX_LIVES = 10;
const DEFAULT_WORD_PICK_TIME = 60; // seconds

// ─── Real-Time Global Stats Tracking ──────────────────────────────────────────
const globalStats = {
  duelsPlayed: 0,
  wordsGuessed: 0,
  totalGuesses: 0,
  correctGuesses: 0,
};

function getStatsPayload(ioInstance) {
  const totalG = globalStats.totalGuesses || 0;
  const correctG = globalStats.correctGuesses || 0;
  const accuracy = totalG > 0 ? Math.round((correctG / totalG) * 100) : (globalStats.duelsPlayed > 0 ? Math.round((globalStats.wordsGuessed / Math.max(1, globalStats.duelsPlayed)) * 100) : 100);
  const activeClients = ioInstance && ioInstance.engine ? Math.max(1, ioInstance.engine.clientsCount) : 1;

  return {
    duelsPlayed: globalStats.duelsPlayed,
    wordsGuessed: globalStats.wordsGuessed,
    totalGuesses: globalStats.totalGuesses,
    correctGuesses: globalStats.correctGuesses,
    winRate: accuracy,
    activePlayers: activeClients,
    activeRooms: Object.keys(rooms).length,
  };
}

function getRandomWord(difficulty = 'medium') {
  let filtered = DICTIONARY_ENTRIES;
  if (difficulty === 'easy') {
    filtered = DICTIONARY_ENTRIES.filter((e) => e.word.length >= 4 && e.word.length <= 5);
  } else if (difficulty === 'medium') {
    filtered = DICTIONARY_ENTRIES.filter((e) => e.word.length >= 6 && e.word.length <= 8);
  } else if (difficulty === 'hard') {
    filtered = DICTIONARY_ENTRIES.filter((e) => e.word.length >= 9);
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

function isValidWord(word) {
  if (!word || word.length < 2) return false;
  const clean = word.toLowerCase().trim();
  if (!/^[a-z]+$/.test(clean)) return false;
  return DICTIONARY_SET.has(clean);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getHiddenWord(word, guessed = []) {
  const guessedUpper = (guessed || []).map((l) => l.toUpperCase());
  return word
    .toUpperCase()
    .split('')
    .map((ch) => (guessedUpper.includes(ch) ? ch : '_'))
    .join(' ');
}

function findPlayer(room, socketId) {
  return room.players.find((p) => p.id === socketId);
}

// ─── Timer Management ──────────────────────────────────────────────────────────
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

      // Auto-select a random word if setter runs out of time
      const word = getRandomWord();
      rooms[roomCode].game.word = word;
      rooms[roomCode].state = 'guessing';

      io.to(roomCode).emit('timer_expired', { word });
      io.to(roomCode).emit('round_started', {
        wordLength: word.length,
        wordSetterId: rooms[roomCode].game.wordSetterId,
        guesserId: rooms[roomCode].game.guesserId,
      });
      broadcastState(io, rooms[roomCode], roomCode);
      console.log(`⏱ Timer expired for room ${roomCode}. Auto-assigned word: "${word}"`);
    }
  }, 1000);
}

// ─── Broadcast Authoritative State ────────────────────────────────────────────
function broadcastState(io, room, roomCode) {
  const timerSecondsLeft = room.timer ? room.timer.secondsLeft : null;
  const timerTotal = (room.settings && room.settings.wordPickTime) || DEFAULT_WORD_PICK_TIME;

  room.players.forEach((player) => {
    const isWordSetter = room.game && room.game.wordSetterId === player.id;
    const setterPlayer = room.players.find((p) => p.id === (room.game && room.game.wordSetterId));
    const guesserPlayer = room.players.find((p) => p.id === (room.game && room.game.guesserId));

    const payload = {
      state: room.state,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isYou: p.id === player.id,
      })),
      settings: room.settings || { wordPickTime: DEFAULT_WORD_PICK_TIME },
      timerSecondsLeft,
      timerTotal,
      game: room.game
        ? {
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
            word: isWordSetter || room.state === 'roundover' ? room.game.word : null,
            roundResult: room.game.roundResult || null,
            wrongGuesses: room.game.wrongGuesses || [],
          }
        : null,
      roomCode,
    };

    io.to(player.id).emit('state_update', payload);
  });
}

// ─── Express App & Socket.io Server ───────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// Express CORS headers for health checks / REST endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Socket.io with Wildcard CORS and Polling + WebSocket fallback
const io = new Server(server, {
  transports: ['polling', 'websocket'], // Polling handshake first to bypass firewalls
  cors: {
    origin: '*', // Relaxed wildcard CORS to eliminate connection/origin mismatch issues
    methods: ['GET', 'POST'],
  },
});

// Health-check endpoints for Render / Railway / Uptime monitoring
app.get('/', (req, res) => {
  res.status(200).send('Hangman Server is running!');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Diagnostic endpoint for browser verification
app.get('/test', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Hangman WebSocket & HTTP Server is running!',
    service: 'hangman-socket-backend',
    timestamp: new Date().toISOString(),
    port: PORT,
    activeRooms: Object.keys(rooms).length,
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hangman-socket-backend',
    activeRooms: Object.keys(rooms).length,
    uptime: process.uptime(),
    stats: getStatsPayload(io),
  });
});

// REST endpoint for real-time stats
app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: getStatsPayload(io) });
});

app.post('/api/stats', express.json(), (req, res) => {
  const { action, isCorrect } = req.body || {};
  if (action === 'record_duel') {
    globalStats.duelsPlayed++;
  } else if (action === 'record_win') {
    globalStats.duelsPlayed++;
    globalStats.wordsGuessed++;
  } else if (action === 'record_guess') {
    globalStats.totalGuesses++;
    if (isCorrect) globalStats.correctGuesses++;
  }
  const payload = getStatsPayload(io);
  io.emit('stats_update', payload);
  res.json({ success: true, stats: payload });
});

// REST endpoint for dictionary entries
app.get('/api/dictionary', (req, res) => {
  res.json(DICTIONARY_ENTRIES);
});

// ─── Socket.io Event Handlers ─────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (Transport: ${socket.conn.transport.name})`);

  // Broadcast updated live players count to everyone
  io.emit('stats_update', getStatsPayload(io));

  // Also send stats directly to the newly connected client
  socket.emit('stats_update', getStatsPayload(io));

  // 1. Create Room
  socket.on('create_room', ({ playerName, wordPickTime }) => {
    if (!playerName || !playerName.trim()) {
      socket.emit('error_msg', 'Please enter your name.');
      return;
    }

    let roomCode;
    do {
      roomCode = generateRoomCode();
    } while (rooms[roomCode]);

    const validTimes = [30, 60, 90, 120];
    const pickedTime = validTimes.includes(Number(wordPickTime))
      ? Number(wordPickTime)
      : DEFAULT_WORD_PICK_TIME;

    rooms[roomCode] = {
      state: 'lobby',
      players: [{ id: socket.id, name: playerName.trim(), score: 0 }],
      game: null,
      timer: null,
      settings: { wordPickTime: pickedTime },
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerName = playerName.trim();

    socket.emit('room_created', { roomCode });
    broadcastState(io, rooms[roomCode], roomCode);
    console.log(`🎮 Room ${roomCode} created by "${playerName.trim()}" (timer: ${pickedTime}s)`);
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').toUpperCase().trim();
    if (!playerName || !playerName.trim()) {
      socket.emit('error_msg', 'Please enter your name.');
      return;
    }
    if (!rooms[code]) {
      socket.emit('error_msg', 'Room not found. Please verify the code.');
      return;
    }

    const room = rooms[code];
    if (room.players.length >= 2) {
      socket.emit('error_msg', 'Room is full (2 players max).');
      return;
    }
    if (room.state !== 'lobby') {
      socket.emit('error_msg', 'Game already in progress in this room.');
      return;
    }

    room.players.push({ id: socket.id, name: playerName.trim(), score: 0 });
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerName = playerName.trim();

    // Auto-start: Host (Player 1) is Setter, Joiner (Player 2) is Guesser
    room.state = 'setting';
    room.game = {
      word: null,
      wordSetterId: room.players[0].id,
      guesserId: room.players[1].id,
      guessedLetters: [],
      wrongGuesses: [],
      livesLeft: MAX_LIVES,
      roundResult: null,
    };

    // Emit game_start to both players simultaneously
    io.to(code).emit('game_start', {
      roomCode: code,
      wordSetterId: room.game.wordSetterId,
      guesserId: room.game.guesserId,
      players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
    });

    broadcastState(io, room, code);
    startSettingTimer(io, code);

    // Send word suggestions to the word setter
    io.to(room.game.wordSetterId).emit('word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });

    console.log(`👥 "${playerName.trim()}" joined room ${code}. Game started.`);
  });

  // 3. Word Suggestions Request
  socket.on('get_suggestions', () => {
    socket.emit('word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });
  });

  // 4. Word Setter Submits Word
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

    const valid = isValidWord(clean);
    if (!valid) {
      socket.emit('word_validation', {
        valid: false,
        reason: `"${clean.toUpperCase()}" is not in the English dictionary.`,
      });
      return;
    }

    stopSettingTimer(roomCode);
    socket.emit('word_validation', { valid: true, reason: '' });

    room.game.word = clean;
    room.state = 'guessing';
    broadcastState(io, room, roomCode);

    io.to(roomCode).emit('round_started', {
      wordLength: clean.length,
      wordSetterId: room.game.wordSetterId,
      guesserId: room.game.guesserId,
    });
  });

  // 5. Guesser Guesses a Letter
  socket.on('guess_letter', ({ letter }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (room.state !== 'guessing') {
      socket.emit('error_msg', 'No active guessing round.');
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
    globalStats.totalGuesses++;

    const isMatch = room.game.word.includes(l);
    if (isMatch) {
      globalStats.correctGuesses++;
    } else {
      room.game.livesLeft--;
      room.game.wrongGuesses.push(l);
    }

    const hidden = getHiddenWord(room.game.word, room.game.guessedLetters);
    if (!hidden.includes('_')) {
      const guesser = findPlayer(room, room.game.guesserId);
      if (guesser) guesser.score++;
      room.game.roundResult = 'guesser_wins';
      room.state = 'roundover';
      globalStats.duelsPlayed++;
      globalStats.wordsGuessed++;
    } else if (room.game.livesLeft <= 0) {
      const setter = findPlayer(room, room.game.wordSetterId);
      if (setter) setter.score++;
      room.game.roundResult = 'setter_wins';
      room.state = 'roundover';
      globalStats.duelsPlayed++;
    }

    broadcastState(io, room, roomCode);
    io.emit('stats_update', getStatsPayload(io));
  });

  // 6. Next Round
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
      wordSetterId: prevGuesser, // Swap roles
      guesserId: prevSetter,
      guessedLetters: [],
      wrongGuesses: [],
      livesLeft: MAX_LIVES,
      roundResult: null,
    };

    broadcastState(io, room, roomCode);
    startSettingTimer(io, roomCode);

    io.to(roomCode).emit('round_transitioning', {
      state: 'setting',
      wordSetterId: room.game.wordSetterId,
    });

    io.to(room.game.wordSetterId).emit('word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });
  });

  // 7. Disconnect
  socket.on('disconnect', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) {
      io.emit('stats_update', getStatsPayload(io));
      return;
    }
    const room = rooms[roomCode];

    stopSettingTimer(roomCode);
    room.players = room.players.filter((p) => p.id !== socket.id);

    if (room.players.length === 0) {
      delete rooms[roomCode];
      console.log(`🗑 Room ${roomCode} deleted (all players disconnected).`);
    } else {
      room.state = 'lobby';
      room.game = null;
      io.to(room.players[0].id).emit('opponent_left');
      broadcastState(io, room, roomCode);
      console.log(`👋 Player left room ${roomCode}. Waiting for new opponent.`);
    }

    io.emit('stats_update', getStatsPayload(io));
  });
});

// ─── Start Server Listener ────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=========================================================`);
  console.log(`🚀 Standalone Hangman WebSocket Server Running on Port ${PORT}`);
  console.log(`🌐 Transports: ['websocket'] (Pure WebSockets Enabled)`);
  console.log(`🛡 Allowed CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`=========================================================\n`);
});
