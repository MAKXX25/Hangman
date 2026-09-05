'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

const LOCAL_STORAGE_KEY = 'hangman_seen_facts';
const API_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
const MAX_RECURSIVE_RETRIES = 5;
const MAX_STORED_FACTS = 1000;

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
    console.warn(`ℹ️ [InfiniteFacts] Deduplication reached limit (${MAX_RECURSIVE_RETRIES} attempts). Selecting fallback.`);
    const fallback = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
    return fallback;
  }

  try {
    const res = await fetch(API_URL, {
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
      console.log(`♻️ [InfiniteFacts] Fact ${factId} already seen. Fetching alternative... (attempt ${retryCount + 1})`);
      return fetchNewFact(seenSet, onNewSeenId, retryCount + 1, signal);
    }

    // New unique fact
    if (factId && typeof onNewSeenId === 'function') {
      onNewSeenId(factId);
    }

    return cleanText;
  } catch (err) {
    if (err.name === 'AbortError') return '';
    console.warn('⚠️ [InfiniteFacts] API request failed. Using failsafe fallback:', err.message);
    const fallback = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
    return fallback;
  }
}

/**
 * Custom hook to stream infinite, non-repeating trivia facts from a public API
 * with persistent LocalStorage deduplication, recursive retries, and offline fallback.
 * 
 * @param {boolean} isActive - Whether the facts interval should be ticking
 * @param {number} intervalMs - Rotation interval in milliseconds (default: 8000ms / 8s)
 * @returns {{ fact: string, isFading: boolean, fetchNextFact: () => Promise<void>, source: string }}
 */
export function useRandomFacts(isActive = true, intervalMs = 8000) {
  const [fact, setFact] = useState(() => {
    return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
  });
  const [isFading, setIsFading] = useState(false);
  const [source, setSource] = useState('fallback');

  const seenFactsRef = useRef(new Set());
  const abortControllerRef = useRef(null);
  const isFetchingRef = useRef(false);

  // ── 2. Anti-Repetition: Initialize Seen Facts from LocalStorage ─────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          seenFactsRef.current = new Set(parsed);
        }
      }
    } catch (err) {
      console.warn('⚠️ [useRandomFacts] Could not load seen facts from localStorage:', err);
    }
  }, []);

  // Save new ID to LocalStorage
  const recordSeenId = useCallback((id) => {
    if (!id) return;
    seenFactsRef.current.add(id);
    try {
      const list = Array.from(seenFactsRef.current);
      const bounded = list.slice(-MAX_STORED_FACTS);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bounded));
    } catch (err) {
      console.warn('⚠️ [useRandomFacts] Could not persist seen fact to localStorage:', err);
    }
  }, []);

  // Fetch with state update
  const getNextFact = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const nextText = await fetchNewFact(
        seenFactsRef.current,
        recordSeenId,
        0,
        controller.signal
      );

      if (nextText) {
        setFact(nextText);
        setSource(FALLBACK_FACTS.includes(nextText) ? 'fallback' : 'api');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [recordSeenId]);

  // Smooth fade transition trigger
  const triggerFactTransition = useCallback(() => {
    setIsFading(true);
    setTimeout(async () => {
      await getNextFact();
      setIsFading(false);
    }, 400); // 400ms fade duration
  }, [getNextFact]);

  // ── 4. Interval Timing Integration (8 Seconds) with Cleanup ─────────────────
  useEffect(() => {
    if (!isActive) return;

    // Load fresh API fact immediately upon activating state
    getNextFact();

    const intervalId = setInterval(() => {
      triggerFactTransition();
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isActive, intervalMs, getNextFact, triggerFactTransition]);

  return {
    fact,
    isFading,
    fetchNextFact: triggerFactTransition,
    source,
    seenCount: seenFactsRef.current.size,
  };
}

export default useRandomFacts;
