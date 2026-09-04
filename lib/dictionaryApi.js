// Client-Side Online Dictionary Lookup Helper with Local Caching

const clientDefCache = new Map();

/**
 * Look up the real dictionary definition, part of speech, phonetic, and examples for any English word.
 * Queries /api/dictionary/define which checks Free Dictionary API and Datamuse API.
 * 
 * @param {string} word - The word to define
 * @returns {Promise<{ word: string, found: boolean, definition?: string, partOfSpeech?: string, phonetic?: string, example?: string, synonyms?: string[], reason?: string }>}
 */
export async function lookupWordDefinition(word) {
  if (!word || typeof word !== 'string') {
    return { word: '', found: false, reason: 'Invalid word.' };
  }

  const clean = word.trim().toUpperCase();
  if (clean.length < 2 || !/^[A-Z]+$/.test(clean)) {
    return { word: clean, found: false, reason: 'Please enter letters only.' };
  }

  if (clientDefCache.has(clean)) {
    return clientDefCache.get(clean);
  }

  try {
    const res = await fetch(`/api/dictionary/define?word=${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (res.ok && data.found) {
      clientDefCache.set(clean, data);
      return data;
    }
    return {
      word: clean,
      found: false,
      reason: data.reason || `"${clean}" is not in online dictionaries.`
    };
  } catch {
    return {
      word: clean,
      found: false,
      reason: 'Could not connect to online dictionary services.'
    };
  }
}
