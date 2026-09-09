/**
 * ═══════════════════════════════════════════════════════════════════
 *  DIFFICULTY_CONFIG — Single Source of Truth for PvE Game Rules
 *
 *  NEVER hardcode lives, clue flags, or word pools anywhere else.
 *  Always derive them from this object via DIFFICULTY_CONFIG[id].
 * ═══════════════════════════════════════════════════════════════════
 */
export const DIFFICULTY_CONFIG = {
  easy: {
    id: 'easy',
    label: 'Easy (Common Words & Clues)',
    maxLives: 6,
    hasClues: true,
    pool: 'common',
    emoji: '🌱',
    name: 'Easy',
    subtitle: 'Common Words & Clues',
    badge: '6 Lives • Clues',
    color: '#34d399',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  medium: {
    id: 'medium',
    label: 'Medium (Standard Vocabulary & Clues)',
    maxLives: 6,
    hasClues: true,
    pool: 'standard',
    emoji: '⚡',
    name: 'Medium',
    subtitle: 'Standard Vocabulary & Clues',
    badge: '6 Lives • Clues',
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  hard: {
    id: 'hard',
    label: 'Hard (Complex Words, 10 Lives, No Clues)',
    maxLives: 10,
    hasClues: false,
    pool: 'complex',
    emoji: '💀',
    name: 'Hard',
    subtitle: 'Complex Words • 10 Lives',
    badge: '10 Lives • No Clues',
    color: '#f43f5e',
    badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
  nightmare: {
    id: 'nightmare',
    label: 'Nightmare (Extreme Words, 4 Lives, No Clues)',
    maxLives: 4,
    hasClues: false,
    pool: 'extreme',
    emoji: '🔥',
    name: 'Nightmare',
    subtitle: 'Extreme Lethal Words • 4 Lives',
    badge: '4 Lives • No Clues',
    color: '#ef4444',
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
  },
};

// ── Fallback word arrays (used when dynamic pools are empty) ────────────────

/** Hard / complex pool fallback: long words with standard English spelling patterns */
export const COMPLEX_FALLBACK_WORDS = [
  { word: 'SYMPHONY',    meaning: 'An elaborate musical composition for orchestra.' },
  { word: 'ZEPHYR',      meaning: 'A gentle, mild breeze.' },
  { word: 'OXYMORON',    meaning: 'A figure of speech combining contradictory terms.' },
  { word: 'KNAPSACK',    meaning: 'A bag with shoulder straps carried on the back.' },
  { word: 'QUARANTINE',  meaning: 'A period of isolation to prevent the spread of disease.' },
  { word: 'JUXTAPOSE',   meaning: 'To place or deal with close together for contrasting effect.' },
  { word: 'LABYRINTH',   meaning: 'A complicated irregular network of passages or paths.' },
  { word: 'PHENOMENON',  meaning: 'A fact or situation that is observed to exist or happen.' },
  { word: 'ARCHIPELAGO', meaning: 'An extensive group of islands.' },
  { word: 'KALEIDOSCOPE',meaning: 'A constantly changing pattern or sequence of elements.' },
];

/** Nightmare / extreme pool fallback: vowel-scarce, rare-letter, notoriously lethal Hangman words */
export const EXTREME_FALLBACK_WORDS = [
  { word: 'SYZYGY',    meaning: 'A conjunction or opposition of celestial bodies.' },
  { word: 'PHLEGM',    meaning: 'The thick viscous substance secreted by the mucous membranes.' },
  { word: 'RHYTHM',    meaning: 'A strong regular repeated pattern of movement or sound.' },
  { word: 'SPHINX',    meaning: 'A mythical creature with a human head and lion body.' },
  { word: 'CWM',       meaning: 'A steep-sided hollow at the head of a valley (cirque).' },
  { word: 'JAZZ',      meaning: 'A type of music originating from African-American communities.' },
  { word: 'XYLOPHONE', meaning: 'A musical instrument with wooden bars struck by mallets.' },
  { word: 'OXYGEN',    meaning: 'A chemical element essential to most forms of life.' },
  { word: 'CRYPT',     meaning: 'An underground room or vault, typically beneath a church.' },
  { word: 'GLYPH',     meaning: 'A carved symbolic figure or character.' },
  { word: 'NYMPH',     meaning: 'A mythological spirit of nature, depicted as a young woman.' },
  { word: 'TRYST',     meaning: 'A private romantic rendezvous between lovers.' },
  { word: 'CRWTH',     meaning: 'An ancient Celtic stringed instrument.' },
  { word: 'FLYBY',     meaning: 'A flight past a point, especially a spacecraft past a planet.' },
  { word: 'PSYCH',     meaning: 'To make someone less confident; also informal for psychology.' },
];

/**
 * Returns the correct config entry for a given difficulty id.
 * Safe fallback to 'medium' if an unknown id is passed.
 * @param {string} difficultyId
 * @returns {typeof DIFFICULTY_CONFIG.medium}
 */
export function getDifficultyConfig(difficultyId) {
  return DIFFICULTY_CONFIG[difficultyId] ?? DIFFICULTY_CONFIG.medium;
}
