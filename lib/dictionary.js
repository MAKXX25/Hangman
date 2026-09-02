import englishWords from 'an-array-of-english-words';
import dictionaryJson from '../dictionary.json';

// Letter rarity weights based on Scrabble & Hangman penalty
const LETTER_WEIGHTS = {
  E: 1, A: 1, I: 1, O: 1, N: 1, R: 1, T: 1, L: 1, S: 1, U: 1,
  D: 2, G: 2, H: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, Y: 4, W: 4, V: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10
};

const COMMON_LETTERS = new Set(['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R']);
const RARE_LETTERS = new Set(['Z', 'Q', 'X', 'J', 'K', 'V', 'W']);
const STANDARD_VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Build fast O(1) Set from all English words plus dictionary words
export const DICTIONARY_SET = new Set(
  englishWords.filter(w => /^[a-z]{3,16}$/i.test(w)).map(w => w.toLowerCase())
);

// Also add all words from dictionary.json
if (Array.isArray(dictionaryJson)) {
  dictionaryJson.forEach(item => {
    if (item && item.word) {
      DICTIONARY_SET.add(item.word.toLowerCase());
    }
  });
}

export const DICTIONARY_LIST = Array.isArray(dictionaryJson) ? dictionaryJson : [];

export function isValidWord(word) {
  if (!word || typeof word !== 'string') return false;
  const clean = word.trim().toLowerCase();
  if (!/^[a-z]{3,16}$/.test(clean)) return false;
  return DICTIONARY_SET.has(clean);
}

/**
 * Categorize a word by authentic letter rarity / Scrabble frequency
 * - Easy: High ratio of common letters (E, T, A, O, I, N, S, H, R) and standard vowels
 * - Hard: High concentration of rare/high-penalty letters (Z, Q, X, J, K, V, W) or lack of standard vowels (RHYTHM, JINX, ZIGZAG, AWKWARD)
 * - Medium: Standard balanced mix of letters
 */
export function calculateWordDifficulty(word) {
  const upper = (word || '').toUpperCase().trim();
  if (!upper) return 'medium';

  const chars = upper.split('');
  const len = chars.length;
  if (len === 0) return 'medium';

  let commonCount = 0;
  let rareCount = 0;
  let vowelCount = 0;
  let totalScore = 0;

  chars.forEach(ch => {
    totalScore += (LETTER_WEIGHTS[ch] || 3);
    if (COMMON_LETTERS.has(ch)) commonCount++;
    if (RARE_LETTERS.has(ch)) rareCount++;
    if (STANDARD_VOWELS.has(ch)) vowelCount++;
  });

  const avgWeight = totalScore / len;
  const commonRatio = commonCount / len;
  const vowelRatio = vowelCount / len;

  // HARD Criteria:
  // 1. Multiple high penalty letters (Z, Q, X, J, K, V, W)
  // 2. Or very low standard vowel ratio (e.g. RHYTHM, CRYPT, SPHINX, GLYPH)
  // 3. Or high average Scrabble letter weight (>= 2.5)
  if (
    rareCount >= 2 ||
    (rareCount >= 1 && len <= 5) ||
    vowelRatio < 0.22 ||
    avgWeight >= 2.5
  ) {
    return 'hard';
  }

  // EASY Criteria:
  // 1. Rich in common letters (E, T, A, O, I, N, S, H, R) >= 55%
  // 2. Good vowel ratio >= 30%
  // 3. Zero rare letters (no Z, Q, X, J, K, V, W)
  // 4. Low average letter weight <= 2.0
  if (
    rareCount === 0 &&
    commonRatio >= 0.55 &&
    vowelRatio >= 0.30 &&
    avgWeight <= 2.0
  ) {
    return 'easy';
  }

  return 'medium';
}

// Pre-categorize dictionary list into pools for O(1) retrieval
export const EASY_WORDS = DICTIONARY_LIST.filter(item => calculateWordDifficulty(item.word) === 'easy');
export const MEDIUM_WORDS = DICTIONARY_LIST.filter(item => calculateWordDifficulty(item.word) === 'medium');
export const HARD_WORDS = DICTIONARY_LIST.filter(item => calculateWordDifficulty(item.word) === 'hard');

/**
 * Anti-Repetition Shuffle Bag word selector
 * @param {'easy' | 'medium' | 'hard'} difficulty
 * @param {string[]} usedWords Array of word strings already used in this session/match
 * @returns {{ word: string, meaning: string, difficulty: string }}
 */
export function getRandomWord(difficulty = 'medium', usedWords = []) {
  let pool = [];
  if (difficulty === 'easy') {
    pool = EASY_WORDS.length ? EASY_WORDS : DICTIONARY_LIST;
  } else if (difficulty === 'hard') {
    pool = HARD_WORDS.length ? HARD_WORDS : DICTIONARY_LIST;
  } else {
    pool = MEDIUM_WORDS.length ? MEDIUM_WORDS : DICTIONARY_LIST;
  }

  if (!pool.length) pool = DICTIONARY_LIST;

  // Filter out already used words (Shuffle Bag check)
  const usedSet = new Set(
    (usedWords || []).map(w => (typeof w === 'string' ? w : w.word || '').toUpperCase().trim())
  );
  let available = pool.filter(item => !usedSet.has(item.word.toUpperCase()));

  // If the available pool drops to 0, reset the shuffle bag by using the full category pool
  if (available.length === 0) {
    available = pool;
  }

  if (available.length === 0) {
    return { word: 'GALAXY', meaning: 'A gravitationally bound system of stars.', difficulty: 'medium' };
  }

  const selected = available[Math.floor(Math.random() * available.length)];
  return {
    ...selected,
    difficulty: calculateWordDifficulty(selected.word)
  };
}

export function getRandomSuggestions(count = 12) {
  const shuffled = [...DICTIONARY_LIST].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getWordMeaning(word) {
  if (!word || typeof word !== 'string') return '';
  const clean = word.trim().toUpperCase();
  const entry = DICTIONARY_LIST.find(item => item.word && item.word.toUpperCase() === clean);
  return entry?.meaning || '';
}
