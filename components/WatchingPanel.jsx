'use client';
import { useState, useEffect } from 'react';
import HangmanCanvas from './HangmanCanvas.jsx';
import { getRandomFact } from '../lib/facts.js';

export default function WatchingPanel({
  game = null,
  isRoundOver = false,
  roundResult = null,
  onSpecialAnimComplete
}) {
  const [currentFact, setCurrentFact] = useState('');

  useEffect(() => {
    setCurrentFact(getRandomFact());
    const interval = setInterval(() => {
      setCurrentFact(getRandomFact());
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const word = game ? (game.word || '') : '';
  const hiddenWord = game ? (game.hiddenWord || '') : '';
  const wrongGuesses = game ? (game.wrongGuesses || []) : [];
  const livesLeft = game ? game.livesLeft : 10;
  const maxLives = game ? game.maxLives : 10;

  return (
    <div className="panel-watching">
      <div className="game-layout">
        {/* Left Column: Visuals & Drawing */}
        <div className="game-visuals glass">
          <div className="role-tag watcher-tag">👀 WATCHING GUESSER PLAY</div>

          <HangmanCanvas
            livesLeft={livesLeft}
            maxLives={maxLives}
            isRoundOver={isRoundOver}
            roundResult={roundResult}
            onSpecialAnimComplete={onSpecialAnimComplete}
          />

          <div className="lives-badge">
            <span className="lives-heart">❤️</span>
            <span className="lives-text">
              OPPONENT LIVES: <strong>{livesLeft}</strong> / {maxLives}
            </span>
          </div>

          {/* Wrong Letters Tags */}
          <div className="wrong-guesses-wrap">
            <span className="wrong-label">THEIR MISTAKES:</span>
            <div className="wrong-letters-list">
              {wrongGuesses.length === 0 ? (
                <span className="no-wrong-text">No mistakes yet</span>
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

        {/* Right Column: Live Word Progression & Facts */}
        <div className="game-interactive glass watcher-view">
          <div className="secret-word-banner">
            YOUR SECRET WORD: <strong>{word}</strong>
          </div>

          <div className="word-slots-container">
            <div className="word-display" id="word-display-watch">
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

          {/* Facts ticker while watching */}
          <div className="watcher-facts-box">
            <div className="facts-header">
              <span className="facts-icon">💡</span>
              <span className="facts-title">HANGMAN TRIVIA</span>
            </div>
            <p className="facts-text">{currentFact}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
