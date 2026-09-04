// ─── Hangman Duel Audio & Speech Engine ──────────────────────────────────────────
// Synthesizes high-fidelity mechanical keyboard switch sounds via Web Audio API
// and provides clean, expressive Text-To-Speech (TTS) for stickman dialogues.

let audioCtx = null;
let voicesLoaded = false;
let preferredVoice = null;

// Initialize or resume Web Audio Context on user interaction
export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

// Auto-unlock Web Audio on first pointer or keyboard gesture
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
}

// ── Voice Selection Helper for SpeechSynthesis ──────────────────────────────
// Prioritizes ultra-natural neural human voices (Edge Online Natural, Google US/UK, Apple Enhanced/Premium)
function getBestVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Filter English voices
    const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const candidateList = enVoices.length > 0 ? enVoices : voices;

    function scoreVoice(v) {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      let score = 0;

      // Gemini Voice Target: If Pulcherrima voice is available in the browser/OS, prioritize immediately
      if (name.includes('pulcherrima')) score += 500;

      // Tier 1: Microsoft Natural Online Neural Voices (Edge / Windows 11) - sounds 100% human
      if (name.includes('natural') && name.includes('online')) score += 100;
      else if (name.includes('natural') || name.includes('neural')) score += 85;

      // Tier 2: Google Chrome US/UK English Neural
      if (name.includes('google')) {
        if (lang.includes('us') || lang.includes('gb') || lang.includes('en-us')) score += 75;
        else score += 65;
      }

      // Tier 3: Apple macOS/iOS Premium & Enhanced voices
      if (name.includes('premium') || name.includes('enhanced')) score += 70;
      if (name.includes('samantha') || name.includes('ava') || name.includes('daniel') || name.includes('serena') || name.includes('oliver')) score += 50;

      // Tier 4: Common natural persona names
      if (name.includes('jenny') || name.includes('guy') || name.includes('aria') || name.includes('christopher') || name.includes('steffan')) score += 45;

      // Language preference for clear English
      if (lang === 'en-us') score += 20;
      else if (lang.startsWith('en')) score += 10;

      // Prefer default if not legacy
      if (v.default) score += 5;

      // Penalize legacy robotic voices
      if (name.includes('desktop') || name.includes('david') || name.includes('zira') || name.includes('george') || name.includes('mark')) {
        score -= 20;
      }

      return score;
    }

    const sorted = [...candidateList].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted[0] || candidateList[0];
  } catch {
    return null;
  }
}

// Pre-load and re-evaluate voices on client
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    const updateVoice = () => {
      preferredVoice = getBestVoice();
      voicesLoaded = true;
    };
    window.speechSynthesis.onvoiceschanged = updateVoice;
    updateVoice();
  } catch {}
}

// ── Preferences: Mute States ────────────────────────────────────────────────
const VOICE_MUTED_KEY = 'hangman_voice_muted';
const SFX_MUTED_KEY = 'hangman_sfx_muted';

export function isVoiceMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(VOICE_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setVoiceMuted(muted) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOICE_MUTED_KEY, muted ? 'true' : 'false');
    if (muted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}
}

export function isSfxMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SFX_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SFX_MUTED_KEY, muted ? 'true' : 'false');
  } catch {}
}

// ── 1. Mechanical Keyboard Sound Synthesizer ─────────────────────────────────
// Simulates the physical acoustics of a tactile/clicky mechanical switch:
//   1. High-frequency transient snap / click leaf (~4.2kHz noise burst)
//   2. Stem bottom-out "thock" / plate impact (triangle drop ~750Hz -> ~400Hz)
//   3. Hollow keycap resonance (~950Hz damped sine wave)
export function playMechanicalClick(options = {}) {
  if (isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Micro-jitter (+-4%) for authentic human typing across different keycaps
    const jitter = 0.96 + Math.random() * 0.08;
    const volumeMultiplier = typeof options.volume === 'number' ? options.volume : 1.0;

    // --- Component 1: Actuation Click (Filtered Noise Snap, ~6ms) ---
    const bufferSize = Math.floor(ctx.sampleRate * 0.007);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(4400 * jitter, now);
    clickFilter.Q.setValueAtTime(3.2, now);

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.55 * volumeMultiplier, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.007);

    noiseSource.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(ctx.destination);
    noiseSource.start(now);

    // --- Component 2: Housing Bottom-Out "Thock" (~28ms) ---
    const thockOsc = ctx.createOscillator();
    const thockGain = ctx.createGain();
    const thockFilter = ctx.createBiquadFilter();

    thockOsc.type = 'triangle';
    const baseFreq = 410 * jitter;
    // Rapid downward pitch envelope mimics kinetic impact
    thockOsc.frequency.setValueAtTime(baseFreq * 1.75, now);
    thockOsc.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.005);

    thockFilter.type = 'lowpass';
    thockFilter.frequency.setValueAtTime(1300 * jitter, now);

    thockGain.gain.setValueAtTime(0.75 * volumeMultiplier, now);
    thockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    thockOsc.connect(thockFilter);
    thockFilter.connect(thockGain);
    thockGain.connect(ctx.destination);

    thockOsc.start(now);
    thockOsc.stop(now + 0.03);

    // --- Component 3: Keycap Cavity Resonance (~15ms) ---
    const capOsc = ctx.createOscillator();
    const capGain = ctx.createGain();
    capOsc.type = 'sine';
    capOsc.frequency.setValueAtTime(920 * jitter, now);

    capGain.gain.setValueAtTime(0.22 * volumeMultiplier, now);
    capGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    capOsc.connect(capGain);
    capGain.connect(ctx.destination);
    capOsc.start(now);
    capOsc.stop(now + 0.018);

  } catch {
    // Non-critical audio error handling
  }
}

let currentTtsAudio = null;
let currentTtsBlobUrl = null;

export function stopDialogue() {
  if (currentTtsAudio) {
    try {
      currentTtsAudio.pause();
      currentTtsAudio.currentTime = 0;
    } catch {}
    currentTtsAudio = null;
  }
  if (currentTtsBlobUrl) {
    try {
      URL.revokeObjectURL(currentTtsBlobUrl);
    } catch {}
    currentTtsBlobUrl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// Browser SpeechSynthesis fallback if offline or GEMINI_API_KEY is not configured
function speakWithBrowserFallback(clean, emotion, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (isVoiceMuted()) return;

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(clean);

    // Dynamic Human Emotional Prosody matching Gemini Pulcherrima's forward style
    let targetPitch = 1.00;
    let targetRate = 1.00;

    switch (emotion) {
      case 'happy':
        targetPitch = 1.02; // Warm, enthusiastic human inflection
        targetRate = 1.02;
        break;
      case 'panic':
        targetPitch = 1.05; // Urgent, heightened danger
        targetRate = 1.08;
        break;
      case 'roast':
      case 'mean':
        targetPitch = 0.98; // Confident, relaxed, slightly dry sarcastic human pacing
        targetRate = 0.97;
        break;
      case 'death':
        targetPitch = 0.88; // Somber, deep finality
        targetRate = 0.90;
        break;
      case 'clue':
        targetPitch = 1.00;
        targetRate = 0.96; // Clear, instructive
        break;
      default:
        targetPitch = 1.00;
        targetRate = 1.00;
        break;
    }

    utterance.pitch = typeof options.pitch === 'number' ? options.pitch : targetPitch;
    utterance.rate = typeof options.rate === 'number' ? options.rate : targetRate;
    utterance.volume = typeof options.volume === 'number' ? options.volume : 0.98;

    if (!preferredVoice) {
      preferredVoice = getBestVoice();
    }
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.__currentUtterance = utterance;
    utterance.onend = () => {
      window.__currentUtterance = null;
    };
    utterance.onerror = () => {
      window.__currentUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  } catch {}
}

// ── 2. Gemini "Pulcherrima" Dialogue Audio Engine ───────────────────────────
// Synthesizes speech using Google's Gemini TTS with the "Pulcherrima" voice model,
// with automatic in-memory caching and seamless fallback to browser neural voices.
export function speakDialogue(rawText, options = {}) {
  if (typeof window === 'undefined') return;
  if (isVoiceMuted()) return;
  if (!rawText || typeof rawText !== 'string') return;

  // Immediately cancel any currently playing dialogue
  stopDialogue();

  try {
    // Clean text: strip emojis, symbols, markdown, and extra whitespace
    let clean = rawText
      // Remove Unicode emoji ranges
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/gu, '')
      // Remove markdown artifacts
      .replace(/[*_~`]/g, '')
      // Remove strange characters but keep basic punctuation for natural speech pauses
      .replace(/[^\w\s.,!?'"-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2) return;

    // Ensure ending punctuation for natural intonation and human pause
    if (!/[.!?]$/.test(clean)) {
      clean += '!';
    }

    // Determine emotional context:
    const lower = clean.toLowerCase();
    const emotion = options.emotion || options.mood || (
      /hanged|dead|loss|died|execution|outsmarted|game over/i.test(lower) ? 'death' :
      /danger|choking|sweating|one left|last chance|yikes|help/i.test(lower) ? 'panic' :
      /yes|great|boom|nice|congratulations|beat|escaped|figured|champion|perfect/i.test(lower) ? 'happy' :
      /oops|missed|nope|wrong|swinging|rope|closer|careful|think again|try again/i.test(lower) ? 'roast' :
      'natural'
    );

    // Call Gemini Pulcherrima TTS API
    const ttsUrl = `/api/tts?text=${encodeURIComponent(clean)}&emotion=${encodeURIComponent(emotion)}`;

    fetch(ttsUrl)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Gemini TTS endpoint returned ${res.status}`);
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('audio')) {
          throw new Error('Response is not an audio stream');
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        currentTtsBlobUrl = blobUrl;

        const audio = new Audio(blobUrl);
        currentTtsAudio = audio;
        audio.volume = typeof options.volume === 'number' ? options.volume : 0.98;

        audio.onended = () => {
          URL.revokeObjectURL(blobUrl);
          if (currentTtsAudio === audio) currentTtsAudio = null;
          if (currentTtsBlobUrl === blobUrl) currentTtsBlobUrl = null;
        };

        audio.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          if (currentTtsAudio === audio) currentTtsAudio = null;
          if (currentTtsBlobUrl === blobUrl) currentTtsBlobUrl = null;
          speakWithBrowserFallback(clean, emotion, options);
        };

        return audio.play();
      })
      .catch(() => {
        // Fallback to browser neural TTS engine if Gemini API is not configured or fails
        speakWithBrowserFallback(clean, emotion, options);
      });

  } catch {
    // Non-critical audio error handling
  }
}
