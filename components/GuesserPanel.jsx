'use client';
import { useEffect } from 'react';
import HangmanCanvas from './HangmanCanvas.jsx';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

export default function GuesserPanel({
  game = null,
  onGuessLetter,
  isRoundOver = false,
  roundResult = null,
  onSpecialAnimComplete
}) {
  const word = game ? (game.word || '') : '';
  const hiddenWord = game ? (game.hiddenWord || '') : '';
  const guessedLetters = game ? (game.guessedLetters || []) : [];
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const livesLeft = game ? game.livesLeft : 10;
  const maxLives = game ? game.maxLives : 10;

  // Physical keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isRoundOver || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key) && !guessedLetters.includes(key)) {
        onGuessLetter(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guessedLetters, isRoundOver, onGuessLetter]);

  const guessedSet = new Set(guessedLetters.map(l => l.toUpperCase()));
  const wrongSet = new Set(wrongGuesses.map(l => l.toUpperCase()));

  return (
    <div className="panel-guesser">
      <div className="game-layout">
        {/* Left Column: Canvas & Lives */}
        <div className="game-visuals glass">
          <div className="lives-badge">
            <span className="lives-heart">❤️</span>
            <span className="lives-text">
              LIVES LEFT: <strong>{livesLeft}</strong> / {maxLives}
            </span>
          </div>

          <HangmanCanvas
            livesLeft={livesLeft}
            maxLives={maxLives}
            isRoundOver={isRoundOver}
            roundResult={roundResult}
            onSpecialAnimComplete={onSpecialAnimComplete}
          />

          {/* Wrong Letters Tags */}
          <div className="wrong-guesses-wrap">
            <span className="wrong-label">WRONG LETTERS:</span>
            <div className="wrong-letters-list">
              {wrongGuesses.length === 0 ? (
                <span className="no-wrong-text">None yet</span>
              ) : (
                wrongGuesses.map((l, i) => (
                  <span key={i} className="wrong-letter-chip">
                    {l}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Word Slots & Interactive Keyboard */}
        <div className="game-interactive glass">
          {/* Word Slots */}
          <div className="word-slots-container">
            <div className="word-display" id="word-display">
              {hiddenWord.split(' ').map((slot, i) => (
                <div
                  key={i}
                  className={`word-slot ${slot !== '_' ? 'filled letter-drop-in' : ''}`}
                >
                  {slot !== '_' ? slot : ''}
                </div>
              ))}
            </div>
          </div>

          {/* On-Screen Keyboard */}
          <div className="keyboard-container" id="keyboard">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="keyboard-row">
                {row.map((letter) => {
                  const isGuessed = guessedSet.has(letter);
                  const isWrong = wrongSet.has(letter);
                  const isCorrect = isGuessed && !isWrong;

                  let keyStateClass = '';
                  if (isCorrect) keyStateClass = 'correct';
                  if (isWrong) keyStateClass = 'wrong';

                  return (
                    <button
                      key={letter}
                      type="button"
                      className={`key-btn ${keyStateClass}`}
                      disabled={isGuessed || isRoundOver}
                      onClick={() => onGuessLetter(letter)}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
