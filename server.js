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
  let accuracy = 0;
  if (totalG > 0) {
    accuracy = Math.round((correctG / totalG) * 100);
  } else if (globalStats.duelsPlayed > 0) {
    accuracy = Math.round(((globalStats.wordsGuessed || 0) / globalStats.duelsPlayed) * 100);
  }
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

function findPlayer(room, idOrSessionId) {
  if (!room) return null;
  const all = [...(room.teamA || []), ...(room.teamB || []), ...(room.players || [])];
  return all.find(
    (p) => p.sessionId === idOrSessionId || p.id === idOrSessionId || p.socketId === idOrSessionId
  );
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

      // Auto-select a random word if setter team runs out of time
      const word = getRandomWord();
      const entry = DICTIONARY_ENTRIES.find((e) => e.word.toLowerCase() === word.toLowerCase());
      rooms[roomCode].game.word = word;
      rooms[roomCode].game.meaning = entry ? entry.meaning : '';
      rooms[roomCode].state = 'guessing';

      io.to(roomCode).emit('timer_expired', { word });
      io.to(roomCode).emit('round_started', {
        wordLength: word.length,
        currentTurn: rooms[roomCode].game.currentTurn,
        wordSettingTeam: rooms[roomCode].game.wordSettingTeam,
      });
      broadcastState(io, rooms[roomCode], roomCode);
      console.log(`⏱ Timer expired for room ${roomCode}. Auto-assigned word: "${word}"`);
    }
  }, 1000);
}

// ─── Build Authoritative State Payload (Team vs Team Format) ─────────────────
function buildStatePayload(room, roomCode, forPlayer) {
  const timerSecondsLeft = room.timer ? room.timer.secondsLeft : null;
  const timerTotal = (room.settings && room.settings.wordPickTime) || DEFAULT_WORD_PICK_TIME;

  const myId = forPlayer ? (forPlayer.sessionId || forPlayer.id) : null;
  const teamA = room.teamA || [];
  const teamB = room.teamB || [];
  const allPlayers = [...teamA, ...teamB];

  const myTeam = teamA.some((p) => (p.sessionId || p.id) === myId)
    ? 'teamA'
    : teamB.some((p) => (p.sessionId || p.id) === myId)
      ? 'teamB'
      : null;

  const currentTurn = room.game ? (room.game.currentTurn || 'teamB') : 'teamB';
  const wordSettingTeam = room.game ? (room.game.wordSettingTeam || 'teamA') : 'teamA';

  const isWordSetter = myTeam === wordSettingTeam;
  const isMyTeamTurn = myTeam === currentTurn;

  return {
    status: room.status || (room.state === 'lobby' || room.state === 'waiting' ? 'waiting' : 'playing'),
    state: room.state,
    teamNameA: room.teamNameA || 'Team A',
    teamNameB: room.teamNameB || 'Team B',
    leaderA: room.leaderA || null,
    leaderB: room.leaderB || null,
    teamA: teamA.map((p) => {
      const pid = p.sessionId || p.id;
      return {
        id: pid,
        sessionId: pid,
        socketId: p.socketId,
        name: p.name,
        isHost: !!p.isHost,
        isLeader: p.socketId === room.leaderA,
        isReady: !!p.isReady,
        score: p.score || 0,
        connected: p.connected !== false,
        team: 'teamA',
        isYou: pid === myId,
      };
    }),
    teamB: teamB.map((p) => {
      const pid = p.sessionId || p.id;
      return {
        id: pid,
        sessionId: pid,
        socketId: p.socketId,
        name: p.name,
        isHost: !!p.isHost,
        isLeader: p.socketId === room.leaderB,
        isReady: !!p.isReady,
        score: p.score || 0,
        connected: p.connected !== false,
        team: 'teamB',
        isYou: pid === myId,
      };
    }),
    players: allPlayers.map((p) => {
      const pid = p.sessionId || p.id;
      const team = teamA.some((m) => (m.sessionId || m.id) === pid) ? 'teamA' : 'teamB';
      return {
        id: pid,
        sessionId: pid,
        socketId: p.socketId,
        name: p.name,
        isHost: !!p.isHost,
        isReady: !!p.isReady,
        score: p.score || 0,
        connected: p.connected !== false,
        team,
        isYou: pid === myId,
      };
    }),
    teamScores: room.teamScores || { teamA: 0, teamB: 0 },
    currentTurn,
    wordSettingTeam,
    myTeam,
    isMyTeamTurn,
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
          currentTurn,
          wordSettingTeam,
          wordSetterId: room.game.wordSetterId,
          guesserId: room.game.guesserId,
          isWordSetter,
          word: isWordSetter || room.state === 'roundover' ? room.game.word : null,
          meaning: room.game.meaning || '',
          hint: room.game.meaning || '',
          roundResult: room.game.roundResult || null,
          wrongGuesses: room.game.wrongGuesses || [],
        }
      : null,
    roomCode,
  };
}

function ensureTeamLeaders(room) {
  if (!room) return;
  const connectedA = (room.teamA || []).filter((p) => p.connected && p.socketId);
  const connectedB = (room.teamB || []).filter((p) => p.connected && p.socketId);

  if (!room.leaderA || !connectedA.some((p) => p.socketId === room.leaderA)) {
    room.leaderA = connectedA.length > 0 ? connectedA[0].socketId : null;
  }
  if (!room.leaderB || !connectedB.some((p) => p.socketId === room.leaderB)) {
    room.leaderB = connectedB.length > 0 ? connectedB[0].socketId : null;
  }
}

// ─── Broadcast Authoritative State ────────────────────────────────────────────
function broadcastState(io, room, roomCode) {
  if (!room) return;
  ensureTeamLeaders(room);
  const allPlayers = [...(room.teamA || []), ...(room.teamB || [])];
  allPlayers.forEach((player) => {
    if (player.socketId) {
      const payload = buildStatePayload(room, roomCode, player);
      io.to(player.socketId).emit('state_update', payload);
    }
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
  const sessionId = socket.handshake?.auth?.sessionId || socket.handshake?.query?.sessionId || socket.id;
  socket.data.sessionId = sessionId;
  console.log(`🔌 Client connected: ${socket.id} (Session ID: ${sessionId}, Transport: ${socket.conn.transport.name})`);

  // Broadcast updated live players count to everyone
  io.emit('stats_update', getStatsPayload(io));
  socket.emit('stats_update', getStatsPayload(io));

  // Check if this sessionId already belongs to a player in an active room
  let existingRoomCode = null;
  let existingRoom = null;
  let existingPlayer = null;

  for (const [code, r] of Object.entries(rooms)) {
    const all = [...(r.teamA || []), ...(r.teamB || [])];
    const p = all.find((pl) => pl.sessionId === sessionId || pl.id === sessionId);
    if (p) {
      existingRoomCode = code;
      existingRoom = r;
      existingPlayer = p;
      break;
    }
  }

  if (existingRoom && existingPlayer) {
    console.log(`♻️ [Session Rejoin] Player "${existingPlayer.name}" (${sessionId}) reconnected to room ${existingRoomCode}`);

    if (existingPlayer.disconnectTimeout) {
      clearTimeout(existingPlayer.disconnectTimeout);
      existingPlayer.disconnectTimeout = null;
    }

    existingPlayer.socketId = socket.id;
    existingPlayer.connected = true;

    socket.join(existingRoomCode);
    socket.data.roomCode = existingRoomCode;
    socket.data.playerName = existingPlayer.name;

    socket.to(existingRoomCode).emit('player_reconnected', {
      sessionId,
      name: existingPlayer.name,
    });

    const restoredPayload = buildStatePayload(existingRoom, existingRoomCode, existingPlayer);
    socket.emit('game_restored', restoredPayload);

    // If game in setting phase and reconnecting player is on setting team, send suggestions
    const settingTeam = existingRoom.game ? (existingRoom.game.wordSettingTeam || 'teamA') : 'teamA';
    const isSetterMember = (existingRoom[settingTeam] || []).some((m) => m.sessionId === sessionId);
    if (existingRoom.state === 'setting' && isSetterMember) {
      socket.emit('word_suggestions', {
        suggestions: getRandomSuggestions(12),
      });
    }

    broadcastState(io, existingRoom, existingRoomCode);
  }

  // 1. Create Room (Host creates room and selects Team A or Team B)
  socket.on('create_room', ({ playerName, wordPickTime, team = 'teamA' }) => {
    const cleanName = (playerName || '').trim();
    if (!cleanName) {
      socket.emit('join_error', { message: 'Please enter your name.' });
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

    const hostTeam = team === 'teamB' ? 'teamB' : 'teamA';
    const hostPlayer = {
      sessionId,
      socketId: socket.id,
      name: cleanName,
      isHost: true,
      isReady: false,
      score: 0,
      connected: true,
      disconnectTimeout: null,
    };

    rooms[roomCode] = {
      status: 'waiting',
      state: 'lobby',
      teamA: hostTeam === 'teamA' ? [hostPlayer] : [],
      teamB: hostTeam === 'teamB' ? [hostPlayer] : [],
      teamNameA: 'Team A',
      teamNameB: 'Team B',
      leaderA: hostTeam === 'teamA' ? socket.id : null,
      leaderB: hostTeam === 'teamB' ? socket.id : null,
      teamScores: { teamA: 0, teamB: 0 },
      game: null,
      timer: null,
      settings: { wordPickTime: pickedTime },
    };

    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    socket.data.playerName = cleanName;
    socket.data.team = hostTeam;

    socket.emit('room_created', { roomCode, team: hostTeam });
    broadcastState(io, rooms[roomCode], roomCode);
    console.log(`🎮 Room ${roomCode} created by Host "${cleanName}" on ${hostTeam === 'teamA' ? 'Team A' : 'Team B'} (timer: ${pickedTime}s)`);
  });

  // 2. Join Room (Team Selection, Capacity Limit & Unique Name Gatekeeper)
  socket.on('join_room', ({ roomCode, playerName, team = 'teamB' }) => {
    const code = (roomCode || '').toUpperCase().trim();
    const cleanName = (playerName || '').trim();

    if (!cleanName) {
      socket.emit('join_error', { message: 'Please enter your name.' });
      return;
    }
    if (!rooms[code]) {
      socket.emit('join_error', { message: 'Room not found. Please verify the code.' });
      return;
    }

    const room = rooms[code];

    // ── The Unique Name Gatekeeper (Case-Insensitive Check) ─────────────────
    const allNames = [...room.teamA.map((p) => p.name), ...room.teamB.map((p) => p.name)];
    const isDuplicate = allNames.some(
      (existingName) => existingName.toLowerCase() === cleanName.toLowerCase()
    );

    // Allow self-reconnection if same sessionId and name
    const isSelfReconnection = [...room.teamA, ...room.teamB].some(
      (p) => p.sessionId === sessionId && p.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate && !isSelfReconnection) {
      socket.emit('join_error', {
        message: 'Name already taken in this room. Please choose another.',
      });
      return;
    }

    // ── Team Capacity Limit (Max 4 players per team) ────────────────────────
    const targetTeam = team === 'teamA' ? 'teamA' : 'teamB';
    const targetTeamName = targetTeam === 'teamA' ? (room.teamNameA || 'Team A') : (room.teamNameB || 'Team B');

    if (room[targetTeam].length >= 4 && !isSelfReconnection) {
      socket.emit('join_error', {
        message: `${targetTeamName} is full (maximum 4 players per team).`,
      });
      return;
    }

    // Handle re-joining player with existing session
    const existingPlayer = [...room.teamA, ...room.teamB].find((p) => p.sessionId === sessionId);
    if (existingPlayer) {
      const oldSocketId = existingPlayer.socketId;
      if (existingPlayer.disconnectTimeout) {
        clearTimeout(existingPlayer.disconnectTimeout);
        existingPlayer.disconnectTimeout = null;
      }
      existingPlayer.socketId = socket.id;
      existingPlayer.connected = true;
      existingPlayer.name = cleanName;
      if (room.leaderA === oldSocketId) room.leaderA = socket.id;
      if (room.leaderB === oldSocketId) room.leaderB = socket.id;
      if (!room.leaderA && room.teamA.some((p) => p.socketId === socket.id)) room.leaderA = socket.id;
      if (!room.leaderB && room.teamB.some((p) => p.socketId === socket.id)) room.leaderB = socket.id;
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.playerName = cleanName;
      socket.data.team = room.teamA.some((p) => p.sessionId === sessionId) ? 'teamA' : 'teamB';
      broadcastState(io, room, code);
      return;
    }

    // Add new player to chosen team
    const newPlayer = {
      sessionId,
      socketId: socket.id,
      name: cleanName,
      isHost: false,
      isReady: false,
      score: 0,
      connected: true,
      disconnectTimeout: null,
    };
    room[targetTeam].push(newPlayer);

    // Auto-Assign: When a player joins a team, if that team's leader is null, automatically assign this first player as the leader.
    if (targetTeam === 'teamA') {
      if (!room.leaderA) room.leaderA = socket.id;
    } else {
      if (!room.leaderB) room.leaderB = socket.id;
    }

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.playerName = cleanName;
    socket.data.team = targetTeam;

    console.log(`👥 "${cleanName}" joined ${targetTeamName} in room ${code}. Team A: ${room.teamA.length}/4 | Team B: ${room.teamB.length}/4`);

    // In Ready-Up architecture: Match does NOT automatically start on join.
    // Instead, emit update_room and broadcastState so players remain in the waiting room to ready up and customize team names.
    io.to(code).emit('update_room', {
      roomCode: code,
      teamA: room.teamA,
      teamB: room.teamB,
    });
    broadcastState(io, room, code);
  });

  // 2b. Assign Team Leader (Host Override Event)
  socket.on('assign_leader', ({ socketId, team }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    const currentSessionId = socket.data.sessionId || sessionId;
    const isHost = [...(room.teamA || []), ...(room.teamB || [])].some(
      (p) => (p.socketId === socket.id || p.sessionId === currentSessionId) && p.isHost
    );

    if (!isHost) {
      socket.emit('error_msg', 'Only the Room Host can assign team leaders.');
      return;
    }

    const targetTeam = team === 'teamB' ? 'teamB' : 'teamA';
    const playerInTeam = (room[targetTeam] || []).find((p) => p.socketId === socketId);

    if (!playerInTeam) {
      socket.emit('error_msg', 'Player not found in that team.');
      return;
    }

    if (targetTeam === 'teamA') {
      room.leaderA = socketId;
    } else {
      room.leaderB = socketId;
    }

    console.log(`👑 Host assigned "${playerInTeam.name}" (${socketId}) as leader of ${targetTeam === 'teamA' ? (room.teamNameA || 'Team A') : (room.teamNameB || 'Team B')} in room ${roomCode}`);
    broadcastState(io, room, roomCode);
  });

  // 2c. Set Team Name (Leader Only Event)
  socket.on('set_team_name', ({ team, name }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    const targetTeam = team === 'teamB' ? 'teamB' : 'teamA';
    const currentLeader = targetTeam === 'teamA' ? room.leaderA : room.leaderB;

    // Validate that the requesting socket is the actual team leader
    if (socket.id !== currentLeader) {
      socket.emit('error_msg', 'Only the Team Leader can set the team name.');
      return;
    }

    const cleanName = (name || '').trim();
    if (!cleanName) {
      socket.emit('error_msg', 'Team name cannot be empty.');
      return;
    }

    const sanitizedName = cleanName.slice(0, 30);

    if (targetTeam === 'teamA') {
      room.teamNameA = sanitizedName;
    } else {
      room.teamNameB = sanitizedName;
    }

    console.log(`🏷️ Team name updated for ${targetTeam}: "${sanitizedName}" by leader ${socket.id} in room ${roomCode}`);
    broadcastState(io, room, roomCode);
    io.to(roomCode).emit('team_name_updated', { team: targetTeam, name: sanitizedName });
  });

  // 2d. Toggle Player Ready State (Waiting Room Phase)
  socket.on('toggle_ready', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    // If game is already active / playing, ignore
    if (room.status === 'playing') return;

    const currentSessionId = socket.data.sessionId || sessionId;
    const allPlayers = [...(room.teamA || []), ...(room.teamB || [])];
    const player = allPlayers.find(
      (p) => p.socketId === socket.id || p.sessionId === currentSessionId
    );

    if (!player) return;

    // Flip ready boolean
    player.isReady = !player.isReady;
    console.log(`🎯 Player "${player.name}" (${player.sessionId}) toggled ready: ${player.isReady} in room ${roomCode}`);

    // Emit update_room and broadcast state so everyone's UI reflects ready status
    io.to(roomCode).emit('update_room', {
      roomCode,
      teamA: room.teamA,
      teamB: room.teamB,
    });
    broadcastState(io, room, roomCode);

    // The Start Condition:
    // Check if all players in both teams are ready, and both teams have at least 1 player
    const allReady = [...room.teamA, ...room.teamB].every((p) => p.isReady);
    if (allReady && room.teamA.length > 0 && room.teamB.length > 0) {
      room.status = 'playing';
      room.state = 'setting';
      room.game = {
        word: null,
        wordSettingTeam: 'teamA', // Team A sets first word
        currentTurn: 'teamB',     // Team B guesses
        wordSetterId: room.teamA[0].sessionId,
        guesserId: room.teamB[0].sessionId,
        guessedLetters: [],
        wrongGuesses: [],
        livesLeft: MAX_LIVES,
        roundResult: null,
      };

      console.log(`🚀 All players ready in room ${roomCode}! Transitioning to active game state...`);

      io.to(roomCode).emit('game_start', {
        roomCode,
        currentTurn: room.game.currentTurn,
        wordSettingTeam: room.game.wordSettingTeam,
        teamA: room.teamA,
        teamB: room.teamB,
      });
      io.to(roomCode).emit('start_game', {
        roomCode,
        currentTurn: room.game.currentTurn,
        wordSettingTeam: room.game.wordSettingTeam,
        teamA: room.teamA,
        teamB: room.teamB,
      });

      broadcastState(io, room, roomCode);
      startSettingTimer(io, roomCode);

      // Send word suggestions to all members of the word setting team
      room.teamA.forEach((member) => {
        if (member.socketId) {
          io.to(member.socketId).emit('word_suggestions', {
            suggestions: getRandomSuggestions(12),
          });
        }
      });
    }
  });

  // 3. Word Suggestions Request
  socket.on('get_suggestions', () => {
    socket.emit('word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });
  });

  // 4. Word Setter Submits Word (Any member of the setting team)
  const handleSetSecretWord = ({ word, clue, meaning }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (room.state !== 'setting') {
      socket.emit('error_msg', 'Not the right time to set a word.');
      return;
    }

    const currentSessionId = socket.data.sessionId || sessionId;
    const settingTeamKey = room.game ? (room.game.wordSettingTeam || 'teamA') : 'teamA';
    const settingTeam = room[settingTeamKey] || [];

    const isMemberOfSettingTeam = settingTeam.some(
      (p) => p.sessionId === currentSessionId || p.socketId === socket.id
    );

    if (!isMemberOfSettingTeam) {
      socket.emit('error_msg', `Only members of ${settingTeamKey === 'teamA' ? 'Team A' : 'Team B'} can submit a word.`);
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

    const valid = isValidWord(clean) || !!clue;
    if (!valid) {
      socket.emit('word_validation', {
        valid: false,
        reason: `"${clean.toUpperCase()}" is not in the English dictionary.`,
      });
      return;
    }

    stopSettingTimer(roomCode);
    socket.emit('word_validation', { valid: true, reason: '' });

    const entry = DICTIONARY_ENTRIES.find((e) => e.word.toLowerCase() === clean);
    const resolvedClue = (typeof clue === 'string' && clue.trim())
      ? clue.trim()
      : (typeof meaning === 'string' && meaning.trim())
      ? meaning.trim()
      : (entry ? entry.meaning : 'A valid English dictionary word.');

    room.game.word = clean;
    room.game.meaning = resolvedClue;
    room.state = 'guessing';
    broadcastState(io, room, roomCode);

    io.to(roomCode).emit('round_started', {
      wordLength: clean.length,
      currentTurn: room.game.currentTurn,
      wordSettingTeam: room.game.wordSettingTeam,
      clue: resolvedClue,
    });
  };

  socket.on('set_word', handleSetSecretWord);
  socket.on('set_secret_word', handleSetSecretWord);

  // 5. Team Guesses a Letter (Any player on the currently active team)
  socket.on('guess_letter', ({ letter }) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (room.state !== 'guessing') {
      socket.emit('error_msg', 'No active guessing round.');
      return;
    }

    const currentSessionId = socket.data.sessionId || sessionId;
    const activeTeamKey = room.game.currentTurn || 'teamB';
    const activeTeamRoster = room[activeTeamKey] || [];

    // Any player whose socket ID / sessionId belongs to the active team is allowed to guess!
    const isMemberOfActiveTeam = activeTeamRoster.some(
      (p) => p.sessionId === currentSessionId || p.socketId === socket.id
    );

    if (!isMemberOfActiveTeam) {
      socket.emit(
        'error_msg',
        `It is not your turn! Only ${activeTeamKey === 'teamA' ? 'Team A' : 'Team B'} can guess right now.`
      );
      return;
    }

    const l = (letter || '').toLowerCase();
    if (!/^[a-z]$/.test(l)) return;
    if (room.game.guessedLetters.includes(l)) {
      socket.emit('error_msg', `"${l.toUpperCase()}" was already guessed.`);
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
      // Guessing team wins round!
      room.teamScores[activeTeamKey] = (room.teamScores[activeTeamKey] || 0) + 1;
      activeTeamRoster.forEach((p) => {
        p.score = (p.score || 0) + 1;
      });
      room.game.roundResult = `${activeTeamKey}_wins`;
      room.state = 'roundover';
      globalStats.duelsPlayed++;
      globalStats.wordsGuessed++;
    } else if (room.game.livesLeft <= 0) {
      // Setting team wins round!
      const settingTeamKey = room.game.wordSettingTeam || 'teamA';
      const settingTeamRoster = room[settingTeamKey] || [];
      room.teamScores[settingTeamKey] = (room.teamScores[settingTeamKey] || 0) + 1;
      settingTeamRoster.forEach((p) => {
        p.score = (p.score || 0) + 1;
      });
      room.game.roundResult = `${settingTeamKey}_wins`;
      room.state = 'roundover';
      globalStats.duelsPlayed++;
    }

    broadcastState(io, room, roomCode);
    io.emit('stats_update', getStatsPayload(io));
  });

  // 6. Next Round (Swaps Setter Team and Guesser Team)
  socket.on('next_round', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || !rooms[roomCode]) return;
    const room = rooms[roomCode];

    if (room.state !== 'roundover') return;

    // Swap roles between Team A and Team B
    const prevSetterTeam = room.game.wordSettingTeam || 'teamA';
    const nextSetterTeam = prevSetterTeam === 'teamA' ? 'teamB' : 'teamA';
    const nextGuesserTeam = nextSetterTeam === 'teamA' ? 'teamB' : 'teamA';

    room.state = 'setting';
    room.game = {
      word: null,
      wordSettingTeam: nextSetterTeam,
      currentTurn: nextGuesserTeam,
      wordSetterId: (room[nextSetterTeam][0] || {}).sessionId,
      guesserId: (room[nextGuesserTeam][0] || {}).sessionId,
      guessedLetters: [],
      wrongGuesses: [],
      livesLeft: MAX_LIVES,
      roundResult: null,
    };

    broadcastState(io, room, roomCode);
    startSettingTimer(io, roomCode);

    io.to(roomCode).emit('round_transitioning', {
      state: 'setting',
      wordSettingTeam: room.game.wordSettingTeam,
      currentTurn: room.game.currentTurn,
    });

    // Send suggestions to all members of the new setting team
    const newSettingTeam = room[nextSetterTeam] || [];
    newSettingTeam.forEach((member) => {
      if (member.socketId) {
        io.to(member.socketId).emit('word_suggestions', {
          suggestions: getRandomSuggestions(12),
        });
      }
    });
  });

  // 7. Explicit Leave Room
  socket.on('leave_room', () => {
    const roomCode = socket.data.roomCode;
    const currentSessionId = socket.data.sessionId || sessionId;
    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];
    stopSettingTimer(roomCode);

    const filterPlayer = (p) => p.sessionId !== currentSessionId && p.socketId !== socket.id;
    room.teamA = (room.teamA || []).filter(filterPlayer);
    room.teamB = (room.teamB || []).filter(filterPlayer);

    socket.leave(roomCode);
    socket.data.roomCode = null;

    const remainingCount = room.teamA.length + room.teamB.length;
    if (remainingCount === 0) {
      delete rooms[roomCode];
      console.log(`🗑 Room ${roomCode} deleted (all players left).`);
    } else {
      if (room.teamA.length === 0 || room.teamB.length === 0) {
        room.state = 'lobby';
        room.game = null;
        io.to(roomCode).emit('opponent_left');
      }
      broadcastState(io, room, roomCode);
    }
    io.emit('stats_update', getStatsPayload(io));
  });

  // 8. Graceful Disconnect (60s Reconnection Window for Team Matches)
  socket.on('disconnect', (reason) => {
    const roomCode = socket.data.roomCode;
    const currentSessionId = socket.data.sessionId || sessionId;
    console.log(`🔌 Socket disconnected: ${socket.id} (Session: ${currentSessionId}, Room: ${roomCode || 'none'}, Reason: ${reason})`);

    if (!roomCode || !rooms[roomCode]) {
      io.emit('stats_update', getStatsPayload(io));
      return;
    }
    const room = rooms[roomCode];
    const player = [...(room.teamA || []), ...(room.teamB || [])].find(
      (p) => p.sessionId === currentSessionId || p.socketId === socket.id
    );

    if (!player) {
      io.emit('stats_update', getStatsPayload(io));
      return;
    }

    // Lobby Disconnect: 30s grace period
    if (room.state === 'lobby') {
      player.connected = false;
      player.socketId = null;

      if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);
      player.disconnectTimeout = setTimeout(() => {
        if (!rooms[roomCode]) return;
        const currentRoom = rooms[roomCode];
        currentRoom.teamA = (currentRoom.teamA || []).filter((p) => p.sessionId !== currentSessionId);
        currentRoom.teamB = (currentRoom.teamB || []).filter((p) => p.sessionId !== currentSessionId);

        if (currentRoom.teamA.length === 0 && currentRoom.teamB.length === 0) {
          delete rooms[roomCode];
          console.log(`🗑 Empty lobby ${roomCode} deleted after 30s timeout.`);
        } else {
          broadcastState(io, currentRoom, roomCode);
        }
        io.emit('stats_update', getStatsPayload(io));
      }, 30000);

      broadcastState(io, room, roomCode);
      io.emit('stats_update', getStatsPayload(io));
      return;
    }

    // Active Duel Disconnect: 60s Reconnection Grace Period
    player.connected = false;
    player.socketId = null;

    io.to(roomCode).emit('player_disconnected', {
      sessionId: player.sessionId,
      playerName: player.name,
      gracePeriodSeconds: 60,
    });

    broadcastState(io, room, roomCode);
    console.log(`⏳ Player "${player.name}" disconnected from room ${roomCode}. 60s grace period active.`);

    if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);

    player.disconnectTimeout = setTimeout(() => {
      if (!rooms[roomCode]) return;
      const currentRoom = rooms[roomCode];
      const p = [...(currentRoom.teamA || []), ...(currentRoom.teamB || [])].find(
        (pl) => pl.sessionId === currentSessionId
      );

      if (p && !p.connected) {
        console.log(`⏰ 60s grace period expired for "${p.name}" in room ${roomCode}.`);
        currentRoom.teamA = (currentRoom.teamA || []).filter((pl) => pl.sessionId !== currentSessionId);
        currentRoom.teamB = (currentRoom.teamB || []).filter((pl) => pl.sessionId !== currentSessionId);

        // If one of the teams now has 0 players, forfeit the match
        if (currentRoom.teamA.length === 0 || currentRoom.teamB.length === 0) {
          stopSettingTimer(roomCode);
          const winningTeam = currentRoom.teamA.length > 0 ? 'Team A' : 'Team B';
          io.to(roomCode).emit('player_forfeit', {
            winner: winningTeam,
            message: `All players on the opposing team disconnected. ${winningTeam} wins!`,
          });
          io.to(roomCode).emit('opponent_left');
          delete rooms[roomCode];
        } else {
          broadcastState(io, currentRoom, roomCode);
        }
        io.emit('stats_update', getStatsPayload(io));
      }
    }, 60000);

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
