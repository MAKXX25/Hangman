'use client';
import { useState, useMemo, useEffect } from 'react';
import { getRandomPerformanceDialogue } from '../lib/gameLogic.js';
import { playMechanicalClick, stopDialogue } from '../lib/audio.js';

export default function GameOverModal({
  isOpen = false,
  game = null,
  players = [],
  isWordSetter = false,
  isPveMode = false,
  onNextRound,
  isWaitingOpponent = false
}) {
  if (!isOpen || !game) return null;

  const setterWins = game.roundResult === 'setter_wins';
  const guesserWon = game.roundResult === 'guesser_wins';

  // Extract distinct usernames
  let setterName = game.setterName || 'Word Setter';
  let guesserName = game.guesserName || 'Guesser';

  if (isPveMode) {
    setterName = 'Computer 🤖';
    guesserName = (players && players[0] && players[0].name) || 'You';
  } else if (players && players.length >= 2) {
    const pSetter = players.find(p => p.id === game.wordSetterId);
    const pGuesser = players.find(p => p.id === game.guesserId || (p.id && p.id !== game.wordSetterId));
    if (pSetter) setterName = pSetter.name;
    if (pGuesser) guesserName = pGuesser.name;
  }

  const amIWordSetter = isPveMode ? false : isWordSetter;

  // Mistakes count
  const mistakesMade = (game.wrongGuesses && Array.isArray(game.wrongGuesses))
    ? game.wrongGuesses.length
    : Math.max(0, (game.maxLives || 10) - (game.livesLeft !== undefined ? game.livesLeft : 10));

  // Determine POV theme & copy
  let themeClass = '';
  let modalIcon = '🎉';
  let title = '';
  let subtitle = '';

  if (setterWins) {
    if (amIWordSetter) {
      themeClass = 'victory-theme';
      modalIcon = '🏆';
      title = 'Execution Successful! 💀';
      subtitle = `Your word stumped ${guesserName}!`;
    } else {
      themeClass = 'defeat-theme';
      modalIcon = '☠️';
      title = 'You Were Hanged! ☠️';
      subtitle = `${setterName}'s word stumped ${isPveMode ? 'you' : guesserName}!`;
    }
  } else if (guesserWon) {
    if (!amIWordSetter) {
      themeClass = 'guesser-victory-theme victory-theme';
      modalIcon = mistakesMade === 0 ? '👑' : (mistakesMade >= 7 ? '😅' : '🎉');
      title = getRandomPerformanceDialogue(mistakesMade, true);
      subtitle = isPveMode
        ? "You figured out Computer's word!"
        : `${guesserName} figured out ${setterName}'s word!`;
    } else {
      themeClass = 'setter-defeat-theme defeat-theme';
      modalIcon = mistakesMade >= 7 ? '💔' : '🏃💨';
      title = getRandomPerformanceDialogue(mistakesMade, false);
      subtitle = `${guesserName} figured out your word!`;
    }
  }

  const cleanWord = (game.word || '').toUpperCase();
  const guessedSet = new Set((game.guessedLetters || []).map(l => l.toUpperCase()));

  useEffect(() => {
    if (isOpen) {
      stopDialogue();
    }
  }, [isOpen]);

  return (
    <div className={`overlay-roundover ${themeClass}`}>
      <div className="roundover-card">
        <div className="roundover-icon" id="roundover-icon">
          {modalIcon}
        </div>
        <h2 className="roundover-title" id="roundover-title">
          {title}
        </h2>
        <p className="roundover-subtitle" id="roundover-subtitle">
          {subtitle}
        </p>

        {/* Revealed Secret Word */}
        <div className="roundover-word-wrap">
          <div className="roundover-word-label">SECRET WORD WAS</div>
          <div className="roundover-word" id="roundover-word">
            {cleanWord.split('').map((ch, idx) => {
              let letterClass = 'word-letter-span ';
              if (guesserWon) {
                letterClass += !amIWordSetter ? 'word-letter-unlocked' : 'word-letter-exposed';
              } else {
                letterClass += guessedSet.has(ch) ? 'word-letter-guessed' : 'word-letter-missed';
              }

              return (
                <span
                  key={idx}
                  className={`${letterClass} cursor-pointer`}
                  style={{ '--index': idx }}
                  onClick={() => playMechanicalClick()}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

        {/* Scores Table */}
        <div className="roundover-scores" id="roundover-scores">
          {players.map((p, i) => (
            <div key={p.id || i} className="rs-player">
              <span className="rs-name">
                {p.name}
                {p.isYou ? ' (You)' : ''}
              </span>
              <span className="rs-score">{p.score}</span>
            </div>
          ))}
        </div>

        <div className="roundover-actions">
          <button
            className="btn btn-primary"
            id="btn-next-round"
            disabled={isWaitingOpponent}
            onClick={() => {
              playMechanicalClick();
              if (onNextRound) onNextRound();
            }}
          >
            {isWaitingOpponent
              ? 'Waiting for opponent…'
              : isPveMode
              ? 'Play Again ↻'
              : 'Next Round ↩ Swap Roles'}
          </button>
        </div>
      </div>
    </div>
  );
}
