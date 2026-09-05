import { NextResponse } from 'next/server';
import dictionaryJson from '../../../../dictionary.json';
import { isValidWord } from '../../../../lib/dictionary.js';

// In-memory cache for fast repeated lookups across players
const DEFINITION_CACHE = new Map();

// Seed cache with local curated dictionary entries
if (Array.isArray(dictionaryJson)) {
  dictionaryJson.forEach(item => {
    if (item && item.word && item.meaning) {
      DEFINITION_CACHE.set(item.word.toLowerCase().trim(), {
        word: item.word.toUpperCase().trim(),
        found: true,
        definition: item.meaning,
        partOfSpeech: item.partOfSpeech || 'noun',
        phonetic: item.phonetic || '',
        example: item.example || '',
        synonyms: item.synonyms || [],
        source: 'Curated Dictionary'
      });
    }
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawWord = searchParams.get('word') || '';
  const clean = rawWord.trim().toLowerCase();

  if (!clean || clean.length < 2 || !/^[a-z]+$/i.test(clean)) {
    return NextResponse.json({
      word: rawWord.toUpperCase(),
      found: false,
      reason: 'Please enter a valid English word (letters only).'
    }, { status: 400 });
  }

  // 1. Check in-memory cache (0ms)
  if (DEFINITION_CACHE.has(clean)) {
    return NextResponse.json(DEFINITION_CACHE.get(clean));
  }

  // 2. Query Free Dictionary API (api.dictionaryapi.dev) with 1500ms timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HangmanDuel/1.0 (Educational Word Game)'
      },
      next: { revalidate: 86400 } // Cache 24 hours
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const firstEntry = data[0];
        const phonetic = firstEntry.phonetic ||
          (firstEntry.phonetics && firstEntry.phonetics.find(p => p.text)?.text) || '';

        // Extract primary definition, part of speech, and example
        let definition = '';
        let partOfSpeech = 'noun';
        let example = '';
        let synonyms = [];

        if (Array.isArray(firstEntry.meanings) && firstEntry.meanings.length > 0) {
          const primaryMeaning = firstEntry.meanings[0];
          partOfSpeech = primaryMeaning.partOfSpeech || 'noun';
          if (Array.isArray(primaryMeaning.definitions) && primaryMeaning.definitions.length > 0) {
            definition = primaryMeaning.definitions[0].definition || '';
            example = primaryMeaning.definitions[0].example || '';
            synonyms = primaryMeaning.definitions[0].synonyms || [];
          }
          if (Array.isArray(primaryMeaning.synonyms) && primaryMeaning.synonyms.length > 0) {
            synonyms = [...new Set([...synonyms, ...primaryMeaning.synonyms])].slice(0, 4);
          }
        }

        if (definition) {
          const result = {
            word: clean.toUpperCase(),
            found: true,
            definition,
            partOfSpeech,
            phonetic,
            example,
            synonyms,
            source: 'Free Dictionary API'
          };
          DEFINITION_CACHE.set(clean, result);
          return NextResponse.json(result);
        }
      }
    }
  } catch (err) {
    console.warn(`[Dictionary Lookup Notice] Primary API error for "${clean}":`, err.message);
  }

  // 3. Fallback: Datamuse API with definitions mode (1200ms timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const dmRes = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(clean)}&md=d&max=1`, {
      signal: controller.signal,
      next: { revalidate: 86400 }
    });

    clearTimeout(timeout);

    if (dmRes.ok) {
      const dmData = await dmRes.json();
      if (Array.isArray(dmData) && dmData.length > 0 && dmData[0].word.toLowerCase() === clean) {
        const item = dmData[0];
        if (Array.isArray(item.defs) && item.defs.length > 0) {
          const rawDef = item.defs[0]; // e.g. "n\tA celestial body..."
          const [posCode, ...defParts] = rawDef.split('\t');
          const defText = defParts.join(' ').trim();

          const posMap = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
          const partOfSpeech = posMap[posCode] || 'word';

          if (defText) {
            const result = {
              word: clean.toUpperCase(),
              found: true,
              definition: defText,
              partOfSpeech,
              phonetic: '',
              example: '',
              synonyms: [],
              source: 'Datamuse Dictionary'
            };
            DEFINITION_CACHE.set(clean, result);
            return NextResponse.json(result);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[Dictionary Lookup Notice] Datamuse fallback error for "${clean}":`, err.message);
  }

  // 4. Fallback: Check authentic English dictionary set (275,000+ words)
  if (isValidWord(clean)) {
    const validWordResult = {
      word: clean.toUpperCase(),
      found: true,
      definition: 'A valid English dictionary word.',
      partOfSpeech: 'noun',
      phonetic: '',
      example: '',
      synonyms: [],
      source: 'English Dictionary'
    };
    DEFINITION_CACHE.set(clean, validWordResult);
    return NextResponse.json(validWordResult);
  }

  // 5. Fallback: Word genuinely not found in any English dictionary
  const notFoundResult = {
    word: clean.toUpperCase(),
    found: false,
    reason: `"${clean.toUpperCase()}" was not found in standard English dictionaries.`
  };
  return NextResponse.json(notFoundResult, { status: 404 });
}
