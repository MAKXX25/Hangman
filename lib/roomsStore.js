// In-memory rooms cache for Next.js API Routes (with global persistence during dev/serverless invocation)
globalThis.__hangmanRooms = globalThis.__hangmanRooms || new Map();
const rooms = globalThis.__hangmanRooms;

// Real-time Global Stats Tracking
globalThis.__hangmanStats = globalThis.__hangmanStats || {
  duelsPlayed: 0,
  wordsGuessed: 0,
  totalGuesses: 0,
  correctGuesses: 0,
  activePlayers: 1,
};
const stats = globalThis.__hangmanStats;

export function getGlobalStats() {
  const totalG = stats.totalGuesses || 0;
  const correctG = stats.correctGuesses || 0;
  let accuracy = 0;
  if (totalG > 0) {
    accuracy = Math.round((correctG / totalG) * 100);
  } else if (stats.duelsPlayed > 0) {
    accuracy = Math.round(((stats.wordsGuessed || 0) / stats.duelsPlayed) * 100);
  }

  // Active players count: connected rooms players + baseline
  let totalRoomPlayers = 0;
  rooms.forEach((r) => {
    if (r && Array.isArray(r.players)) totalRoomPlayers += r.players.length;
  });

  return {
    duelsPlayed: stats.duelsPlayed,
    wordsGuessed: stats.wordsGuessed,
    totalGuesses: stats.totalGuesses,
    correctGuesses: stats.correctGuesses,
    winRate: accuracy,
    activePlayers: Math.max(1, stats.activePlayers, totalRoomPlayers),
    activeRooms: rooms.size,
  };
}

export function recordDuelPlayed() {
  stats.duelsPlayed = (stats.duelsPlayed || 0) + 1;
  return getGlobalStats();
}

export function recordWordGuessed() {
  stats.wordsGuessed = (stats.wordsGuessed || 0) + 1;
  return getGlobalStats();
}

export function recordGuess(isCorrect = false) {
  stats.totalGuesses = (stats.totalGuesses || 0) + 1;
  if (isCorrect) {
    stats.correctGuesses = (stats.correctGuesses || 0) + 1;
  }
  return getGlobalStats();
}

export function updateActivePlayers(count) {
  if (typeof count === 'number') {
    stats.activePlayers = Math.max(1, count);
  }
  return getGlobalStats();
}

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

export function saveRoom(code, roomData) {
  if (!code) return;
  rooms.set(code.toUpperCase(), roomData);
}

export function deleteRoom(code) {
  if (!code) return;
  rooms.delete(code.toUpperCase());
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
