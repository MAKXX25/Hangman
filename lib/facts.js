// ─── 3. The Failsafe Fallback (10 Curated Word & Language Facts) ───────────────
export const FALLBACK_FACTS = [
  "The word 'Hangman' was first recorded in Victorian England in Alice Bertha Gomme's 1894 game book.",
  "'Rhythm' is the longest common English word without a standard vowel (A, E, I, O, U).",
  "The letter 'E' is the most frequently used letter in English, appearing in roughly 11% of all words.",
  "The dot over the lower-case letters 'i' and 'j' is officially called a 'tittle'.",
  "'Uncopyrightable' is the longest English word that can be spelled without repeating any letter.",
  "The word 'set' has the highest number of definitions in the English dictionary (over 430!).",
  "A sentence containing every letter of the alphabet at least once is known as a 'pangram'.",
  "'Dreamt' is the only common English word that ends with the letters 'mt'.",
  "No common English words rhyme with month, orange, silver, or purple.",
  "'Typewriter' is one of the longest words you can type using only the top row of a standard QWERTY keyboard."
];

// Retain RANDOM_FACTS export for backward compatibility
export const RANDOM_FACTS = FALLBACK_FACTS;

export const LOCAL_STORAGE_FACTS_KEY = 'hangman_seen_facts';
export const FACTS_API_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
const MAX_RECURSIVE_RETRIES = 5;

/**
 * Fetch a single fact with deduplication against seen facts in LocalStorage
 * @param {Set<string>} seenSet - Set of seen fact IDs
 * @param {Function} onNewSeenId - Callback when a new fact ID is accepted
 * @param {number} retryCount - Recursion retry counter
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<string>}
 */
export async function fetchNewFact(seenSet = new Set(), onNewSeenId = null, retryCount = 0, signal = null) {
  if (retryCount >= MAX_RECURSIVE_RETRIES) {
    console.warn(`ℹ️ [Facts] Deduplication reached limit (${MAX_RECURSIVE_RETRIES} attempts). Selecting fallback.`);
    return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
  }

  try {
    const res = await fetch(FACTS_API_URL, {
      signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`API responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const factId = data?.id;
    const rawText = data?.text || '';
    const cleanText = rawText.replace(/\s+/g, ' ').trim();

    if (!cleanText) {
      throw new Error('Empty fact returned from API');
    }

    // ── 2. The Filter: Check if fact ID has already been seen ─────────────────
    if (factId && seenSet.has(factId)) {
      console.log(`♻️ [Facts] Fact ${factId} already seen. Fetching alternative... (attempt ${retryCount + 1})`);
      return fetchNewFact(seenSet, onNewSeenId, retryCount + 1, signal);
    }

    // New unique fact
    if (factId && typeof onNewSeenId === 'function') {
      onNewSeenId(factId);
    }

    return cleanText;
  } catch (err) {
    if (err.name === 'AbortError') return '';
    console.warn('⚠️ [Facts] API request failed. Using failsafe fallback:', err.message);
    return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
  }
}

/**
 * Fallback selector for Did You Know facts
 * @param {string[]} usedFacts
 * @returns {string}
 */
export function getRandomFact(usedFacts = []) {
  const usedSet = new Set(usedFacts || []);
  let available = FALLBACK_FACTS.filter(f => !usedSet.has(f));
  if (available.length === 0) {
    available = FALLBACK_FACTS;
  }
  return available[Math.floor(Math.random() * available.length)];
}
