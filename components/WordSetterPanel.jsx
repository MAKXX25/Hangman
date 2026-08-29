'use client';
import { useState, useEffect } from 'react';
import { getRandomFact } from '../lib/facts.js';
import { getRandomSuggestions, isValidWord } from '../lib/dictionary.js';

export default function WordSetterPanel({
  timerSecondsLeft = 60,
  timerTotal = 60,
  onSubmitWord
}) {
  const [inputVal, setInputVal] = useState('');
  const [errorText, setErrorText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [currentFact, setCurrentFact] = useState('');

  useEffect(() => {
    setSuggestions(getRandomSuggestions(3));
    setCurrentFact(getRandomFact());
    const interval = setInterval(() => {
      setCurrentFact(getRandomFact());
    }, 7000);
    return () => clearInterval(interval);
  }, []);

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
              if (e.key === 'Enter') handleSubmit();
            }}
            autoComplete="off"
            autoFocus
          />
          <button
            className="btn btn-primary btn-submit-word"
            onClick={() => handleSubmit()}
          >
            SET WORD ↵
          </button>
        </div>
        {errorText && <div className="word-validation-error">{errorText}</div>}
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
