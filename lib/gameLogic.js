import { isValidWord, getRandomWord } from './dictionary.js';

export const MAX_LIVES = 10;
export const DEFAULT_WORD_PICK_TIME = 60;

export const GUESSER_PERFORMANCE_DIALOGUES = {
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

export const SETTER_PERFORMANCE_DIALOGUES = {
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

export function getRandomPerformanceDialogue(mistakes, isWinningGuesser) {
  const pool = isWinningGuesser ? GUESSER_PERFORMANCE_DIALOGUES : SETTER_PERFORMANCE_DIALOGUES;
  let tierList;

  if (mistakes === 0) {
    tierList = pool.tier1_flawless;
  } else if (mistakes >= 1 && mistakes <= 3) {
    tierList = pool.tier2_great;
  } else if (mistakes >= 4 && mistakes <= 6) {
    tierList = pool.tier3_average;
  } else {
    tierList = pool.tier4_closeCall;
  }

  const randomIndex = Math.floor(Math.random() * tierList.length);
  return tierList[randomIndex];
}

export function getHiddenWord(word, guessedLetters = []) {
  if (!word) return '';
  const guessedSet = new Set(guessedLetters.map(l => l.toUpperCase()));
  return word
    .toUpperCase()
    .split('')
    .map(ch => (guessedSet.has(ch) ? ch : '_'))
    .join(' ');
}

export function createInitialRoom(roomCode, hostName, wordPickTime = DEFAULT_WORD_PICK_TIME) {
  return {
    roomCode,
    state: 'waiting', // waiting | setting | guessing | roundover
    players: [
      { id: 'player_1', name: hostName, score: 0, isReady: true }
    ],
    settings: { wordPickTime: Number(wordPickTime) || DEFAULT_WORD_PICK_TIME },
    game: null,
    currentRoundToken: 1,
    setterStartedAt: null
  };
}

export function startRound(room, setterIndex = 0) {
  const setter = room.players[setterIndex % room.players.length];
  const guesser = room.players[(setterIndex + 1) % room.players.length];
  const wordPickTime = (room.settings && room.settings.wordPickTime) || DEFAULT_WORD_PICK_TIME;

  return {
    ...room,
    state: 'setting',
    currentRoundToken: (room.currentRoundToken || 0) + 1,
    timerSecondsLeft: wordPickTime,
    timerTotal: wordPickTime,
    setterStartedAt: Date.now(),
    game: {
      wordSetterId: setter.id,
      guesserId: guesser ? guesser.id : null,
      setterName: setter.name,
      guesserName: guesser ? guesser.name : 'Guesser',
      word: null,
      hiddenWord: '',
      guessedLetters: [],
      wrongGuesses: [],
      livesLeft: MAX_LIVES,
      maxLives: MAX_LIVES,
      roundResult: null
    }
  };
}

export function applyWordChoice(room, word) {
  if (!room.game) return room;
  const cleanWord = word.trim().toUpperCase();

  return {
    ...room,
    state: 'guessing',
    setterStartedAt: null,
    game: {
      ...room.game,
      word: cleanWord,
      hiddenWord: getHiddenWord(cleanWord, []),
      guessedLetters: [],
      wrongGuesses: [],
      livesLeft: MAX_LIVES,
      roundResult: null
    }
  };
}

export function processGuess(room, letter) {
  if (!room.game || room.state !== 'guessing') return room;
  const ch = letter.toUpperCase();
  if (room.game.guessedLetters.includes(ch)) return room;

  const newGuessedLetters = [...room.game.guessedLetters, ch];
  const isCorrect = room.game.word.includes(ch);

  let newWrongGuesses = [...room.game.wrongGuesses];
  let newLives = room.game.livesLeft;

  if (!isCorrect) {
    newWrongGuesses.push(ch);
    newLives = Math.max(0, newLives - 1);
  }

  const newHiddenWord = getHiddenWord(room.game.word, newGuessedLetters);
  const isWordGuessed = !newHiddenWord.includes('_');
  const isGuesserHanged = newLives <= 0;

  let nextState = 'guessing';
  let roundResult = null;
  let updatedPlayers = room.players.map(p => ({ ...p }));

  if (isWordGuessed) {
    nextState = 'roundover';
    roundResult = 'guesser_wins';
    const guesser = updatedPlayers.find(p => p.id === room.game.guesserId) || updatedPlayers[0];
    if (guesser) guesser.score += 1;
  } else if (isGuesserHanged) {
    nextState = 'roundover';
    roundResult = 'setter_wins';
    const setter = updatedPlayers.find(p => p.id === room.game.wordSetterId) || updatedPlayers[0];
    if (setter) setter.score += 1;
  }

  return {
    ...room,
    state: nextState,
    players: updatedPlayers,
    game: {
      ...room.game,
      guessedLetters: newGuessedLetters,
      wrongGuesses: newWrongGuesses,
      livesLeft: newLives,
      hiddenWord: newHiddenWord,
      roundResult
    }
  };
}
