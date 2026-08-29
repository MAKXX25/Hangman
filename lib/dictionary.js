import englishWords from 'an-array-of-english-words';
import dictionaryJson from '../dictionary.json';

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

export function getRandomWord(difficulty = 'medium') {
  let pool = [];
  if (difficulty === 'easy') {
    pool = DICTIONARY_LIST.filter(item => {
      const len = item.word.length;
      return len >= 4 && len <= 5;
    });
  } else if (difficulty === 'hard') {
    pool = DICTIONARY_LIST.filter(item => {
      const len = item.word.length;
      return len >= 9;
    });
  } else {
    pool = DICTIONARY_LIST.filter(item => {
      const len = item.word.length;
      return len >= 6 && len <= 8;
    });
  }

  if (!pool.length) pool = DICTIONARY_LIST;
  if (!pool.length) {
    return { word: 'GALAXY', meaning: 'A gravitationally bound system of stars.' };
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRandomSuggestions(count = 12) {
  const shuffled = [...DICTIONARY_LIST].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
