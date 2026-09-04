'use client';
import { useState, useEffect } from 'react';
import { getRandomFact } from '../lib/facts.js';
import { getRandomSuggestions, isValidWord } from '../lib/dictionary.js';
import { playMechanicalClick } from '../lib/audio.js';
import { lookupWordDefinition } from '../lib/dictionaryApi.js';

export default function WordSetterPanel({
  timerSecondsLeft = 60,
  timerTotal = 60,
  onSubmitWord
}) {
  const [inputVal, setInputVal] = useState('');
  const [errorText, setErrorText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [currentFact, setCurrentFact] = useState('');
  const [liveWordDef, setLiveWordDef] = useState(null);
  const [isLookingUpDef, setIsLookingUpDef] = useState(false);

  useEffect(() => {
    setSuggestions(getRandomSuggestions(3));
    setCurrentFact(getRandomFact());
    const interval = setInterval(() => {
      setCurrentFact(getRandomFact());
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  // Real-time live online dictionary definition lookup as setter types
  useEffect(() => {
    const clean = (inputVal || '').trim().toUpperCase();
    if (clean.length < 3 || !/^[A-Z]+$/.test(clean)) {
      setLiveWordDef(null);
      setIsLookingUpDef(false);
      return;
    }

    setIsLookingUpDef(true);
    const timer = setTimeout(async () => {
      try {
        const data = await lookupWordDefinition(clean);
        setLiveWordDef(data);
      } catch {
        setLiveWordDef(null);
      } finally {
        setIsLookingUpDef(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputVal]);

  const handleSubmit = (wordToSubmit) => {
    const word = (wordToSubmit || inputVal).trim().toUpperCase();
    if (!word) {
      setErrorText('Please enter a secret word.');
      return;
    }
    if (word.length < 3 || word.length > 12) {
      setErrorText('Word must be between 3 and 12 letters.');
      return;
    }
    if (!/^[A-Z]+$/.test(word)) {
      setErrorText('Letters only (A-Z), no numbers or symbols.');
      return;
    }
    if (!isValidWord(word)) {
      setErrorText(`"${word}" is not recognized in the English dictionary.`);
      return;
    }
    setErrorText('');
    onSubmitWord(word);
  };

  const fraction = Math.max(0, timerSecondsLeft / Math.max(1, timerTotal));
  const circumference = 2 * Math.PI * 40;
  const strokeOffset = circumference * (1 - fraction);

  return (
    <div className="panel-setter glass">
      <div className="setter-header">
        <div className="role-tag setter-tag">👑 YOU ARE THE WORD SETTER</div>
        <h2>Pick a Secret Word</h2>
        <p className="setter-instructions">
          Choose a clever English word (3–12 letters) for your opponent to guess.
        </p>
      </div>

      {/* Circular Timer Ring */}
      <div className="setter-timer-wrap">
        <svg className="timer-ring-svg" width="96" height="96" viewBox="0 0 96 96">
          <circle className="timer-ring-bg" cx="48" cy="48" r="40" strokeWidth="6" />
          <circle
            className={`timer-ring-fill ${
              timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''
            }`}
            cx="48"
            cy="48"
            r="40"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
          />
        </svg>
        <div
          className={`setter-timer-val ${
            timerSecondsLeft <= 10 ? 'danger' : timerSecondsLeft <= 20 ? 'warn' : ''
          }`}
        >
          {timerSecondsLeft}s
        </div>
      </div>

      {/* Word Input */}
      <div className="word-input-wrap">
        <div className="input-with-validation">
          <input
            type="text"
            className="input-word"
            placeholder="Type your secret word…"
            maxLength={12}
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value.toUpperCase());
              setErrorText('');
            }}
            onKeyDown={(e) => {
              if (/^[a-zA-Z]$/.test(e.key) || e.key === 'Backspace' || e.key === ' ') {
                playMechanicalClick();
              }
              if (e.key === 'Enter') handleSubmit();
            }}
            autoComplete="off"
            autoFocus
          />
          <button
            className="btn btn-primary btn-submit-word"
            onClick={() => {
              playMechanicalClick();
              handleSubmit();
            }}
          >
            SET WORD ↵
          </button>
        </div>
        {errorText && <div className="word-validation-error">{errorText}</div>}

        {/* Real-Time Online Dictionary Meaning & Definition Card */}
        {(isLookingUpDef || (inputVal.length >= 3 && liveWordDef)) && (
          <div className="w-full max-w-xl mx-auto my-3 p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/35 backdrop-blur-xl shadow-lg transition-all animate-fadeIn">
            {isLookingUpDef ? (
              <div className="flex items-center justify-center gap-2 py-1.5 text-purple-300 font-mono text-xs">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
                <span>Parsing online dictionary for &ldquo;{inputVal}&rdquo;…</span>
              </div>
            ) : liveWordDef?.found ? (
              <div className="flex flex-col gap-1 text-left">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-bold text-sm text-yellow-300">
                      📖 {liveWordDef.word}
                    </span>
                    {liveWordDef.partOfSpeech && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 italic">
                        {liveWordDef.partOfSpeech}
                      </span>
                    )}
                    {liveWordDef.phonetic && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {liveWordDef.phonetic}
                      </span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ✓ Verified
                  </span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {liveWordDef.definition}
                </p>
                {liveWordDef.example && (
                  <p className="text-[11px] text-purple-200/80 italic pl-1.5 border-l-2 border-purple-400/40">
                    &ldquo;{liveWordDef.example}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-300 font-mono text-xs">
                <span>⚠️</span>
                <span>{liveWordDef?.reason || `No dictionary definition found for "${inputVal}".`}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggested Words */}
      <div className="suggested-words-section">
        <div className="suggested-label">OR PICK A SUGGESTED WORD:</div>
        <div className="suggested-chips">
          {suggestions.map((w) => (
            <button
              key={w}
              type="button"
              className="chip-word"
              onClick={() => {
                playMechanicalClick();
                setInputVal(w);
                handleSubmit(w);
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Did You Know Facts Ticker */}
      <div className="setter-facts-box">
        <div className="facts-header">
          <span className="facts-icon">💡</span>
          <span className="facts-title">DID YOU KNOW?</span>
        </div>
        <p className="facts-text">{currentFact}</p>
      </div>
    </div>
  );
}
