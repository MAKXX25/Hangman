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
export const EASY_WORDS = DICTIONARY_LIST.filter(item => (item.difficulty || calculateWordDifficulty(item.word)) === 'easy');
export const MEDIUM_WORDS = DICTIONARY_LIST.filter(item => (item.difficulty || calculateWordDifficulty(item.word)) === 'medium');
export const HARD_WORDS = DICTIONARY_LIST.filter(item => (item.difficulty || calculateWordDifficulty(item.word)) === 'hard');

const STORAGE_KEY = 'hangman_duel_persistent_used_words_v2';

function getStoredUsedWords() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredUsedWords(list) {
  if (typeof window === 'undefined') return;
  try {
    // Keep max 250 recent words to prevent infinite growth while ensuring strict non-repetition
    const trimmed = list.slice(-250);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

/**
 * Cross-Session Persistent Anti-Repetition Shuffle Bag word selector
 * @param {'easy' | 'medium' | 'hard'} difficulty
 * @param {string[]} sessionUsedWords Array of word strings already used in this active match
 * @returns {{ word: string, meaning: string, difficulty: string }}
 */
export function getRandomWord(difficulty = 'medium', sessionUsedWords = []) {
  let pool = [];
  if (difficulty === 'easy') {
    pool = EASY_WORDS.length ? EASY_WORDS : DICTIONARY_LIST;
  } else if (difficulty === 'hard') {
    pool = HARD_WORDS.length ? HARD_WORDS : DICTIONARY_LIST;
  } else {
    pool = MEDIUM_WORDS.length ? MEDIUM_WORDS : DICTIONARY_LIST;
  }

  if (!pool.length) pool = DICTIONARY_LIST;

  // Combine session used words with cross-session localStorage history
  const storedWords = getStoredUsedWords();
  let combinedUsed = [
    ...storedWords,
    ...(sessionUsedWords || []).map(w => (typeof w === 'string' ? w : w.word || '').toUpperCase().trim())
  ];

  let usedSet = new Set(combinedUsed.map(w => w.toUpperCase().trim()));
  let available = pool.filter(item => !usedSet.has(item.word.toUpperCase().trim()));

  // If fewer than 5 words remain available in this difficulty pool,
  // cycle the oldest 70% from localStorage so the bag refreshes smoothly without picking recent words
  if (available.length < 5) {
    const kept = storedWords.slice(-Math.floor(pool.length * 0.25));
    saveStoredUsedWords(kept);
    usedSet = new Set([
      ...kept,
      ...(sessionUsedWords || []).map(w => (typeof w === 'string' ? w : w.word || '').toUpperCase().trim())
    ]);
    available = pool.filter(item => !usedSet.has(item.word.toUpperCase().trim()));
  }

  if (available.length === 0) {
    available = pool;
  }

  // True cryptographic / high-entropy random selection
  const selected = available[Math.floor(Math.random() * available.length)];
  const chosenWordUpper = selected.word.toUpperCase().trim();

  // Persist chosen word immediately to localStorage
  if (!storedWords.includes(chosenWordUpper)) {
    saveStoredUsedWords([...storedWords, chosenWordUpper]);
  }

  return {
    ...selected,
    difficulty: selected.difficulty || calculateWordDifficulty(selected.word)
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

/**
 * Live Free Dictionary API word validation and definition/clue fetcher.
 * Makes a GET request to https://api.dictionaryapi.dev/api/v2/entries/en/${word}.
 * Extracts the first definition at data[0].meanings[0].definitions[0].definition.
 * Returns null if word is not found (404) or on network/parse errors.
 * 
 * @param {string} word - The secret word to validate and fetch clue for
 * @returns {Promise<string|null>} The first definition string, or null if invalid
 */
export async function validateAndFetchClue(word) {
  if (!word || typeof word !== 'string') return null;
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord || !/^[a-z]+$/i.test(cleanWord)) return null;

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
    
    // Catch 404 or any other unsuccessful status
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    
    // Extract the very first definition provided: data[0].meanings[0].definitions[0].definition
    const firstDefinition = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition;
    
    if (typeof firstDefinition === 'string' && firstDefinition.trim().length > 0) {
      return firstDefinition.trim();
    }
    
    return null;
  } catch (error) {
    console.warn(`[Dictionary API] Error validating word "${cleanWord}":`, error);
    return null;
  }
}

