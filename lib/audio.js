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
function getBestVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // Prefer high-quality expressive English voices
    const enVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));
    if (enVoices.length === 0) return voices[0];

    const premium = enVoices.find(v => 
      v.name.includes('Natural') || 
      v.name.includes('Google') || 
      v.name.includes('Samantha') || 
      v.name.includes('Daniel') ||
      v.name.includes('Alex')
    );

    return premium || enVoices.find(v => v.default) || enVoices[0];
  } catch {
    return null;
  }
}

// Pre-load voices on client
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      preferredVoice = getBestVoice();
      voicesLoaded = true;
    };
    preferredVoice = getBestVoice();
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

// ── 2. Text-To-Speech (TTS) Engine for Dialogues ─────────────────────────────
// Strips emojis and punctuation artifacts, then reads dialogue aloud
// with expressive cartoonish pitch and snappy pacing.
export function speakDialogue(rawText, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (isVoiceMuted()) return;
  if (!rawText || typeof rawText !== 'string') return;

  try {
    // Clean text: strip emojis, symbols, markdown, and extra whitespace
    const clean = rawText
      // Remove Unicode emoji ranges
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1FA00}-\u{1FAFF}]/gu, '')
      // Remove markdown artifacts
      .replace(/[*_~`]/g, '')
      // Remove strange characters but keep basic punctuation for natural speech pauses
      .replace(/[^\w\s.,!?'"-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean.length < 2) return;

    // Cancel currently speaking dialogues so rapid responses don't queue indefinitely
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    
    // Expressive, slightly energetic cartoon stickman persona
    utterance.pitch = typeof options.pitch === 'number' ? options.pitch : 1.16;
    utterance.rate = typeof options.rate === 'number' ? options.rate : 1.06;
    utterance.volume = typeof options.volume === 'number' ? options.volume : 0.95;

    if (!preferredVoice) {
      preferredVoice = getBestVoice();
    }
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    // Retain reference on window to prevent premature garbage collection in Chrome
    window.__currentUtterance = utterance;
    utterance.onend = () => {
      window.__currentUtterance = null;
    };
    utterance.onerror = () => {
      window.__currentUtterance = null;
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful fallback if speech synthesis is blocked
  }
}
