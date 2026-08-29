'use client';
import { useState } from 'react';

export default function Lobby({
  playerName = '',
  setPlayerName,
  onCreateRoom,
  onJoinRoom,
  onStartPve,
  errorMsg = '',
  isLoading = false
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [pveDifficulty, setPveDifficulty] = useState('medium');

  return (
    <div className="screen active" id="screen-lobby">
      <div className="lobby-card glass">
        {/* Header */}
        <div className="lobby-header">
          <div className="game-badge">⚡ REAL-TIME MULTIPLAYER & PVE</div>
          <h1 className="game-title">
            HANGMAN <span className="title-accent">DUEL</span>
          </h1>
          <p className="game-subtitle">
            Outsmart your opponent or save the stickman in a neon word showdown.
          </p>
        </div>

        {/* Player Name Input */}
        <div className="input-group">
          <label htmlFor="input-player-name">YOUR NICKNAME</label>
          <div className="input-wrap">
            <span className="input-icon">👤</span>
            <input
              type="text"
              id="input-player-name"
              placeholder="Enter your name"
              maxLength={16}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="lobby-error" id="lobby-error">
            {errorMsg}
          </div>
        )}

        {/* Actions Grid */}
        <div className="lobby-actions">
          {/* Create Room Button */}
          <button
            id="btn-create-room"
            className="btn btn-primary btn-glow"
            disabled={isLoading || !playerName.trim()}
            onClick={onCreateRoom}
          >
            <span className="btn-icon">⚡</span>
            <span>CREATE PRIVATE ROOM</span>
          </button>

          <div className="divider">
            <span>OR JOIN EXISTING</span>
          </div>

          {/* Join Room Input & Button */}
          <div className="join-row">
            <input
              type="text"
              id="input-room-code"
              placeholder="6-DIGIT CODE"
              maxLength={6}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button
              id="btn-join-room"
              className="btn btn-secondary"
              disabled={isLoading || !playerName.trim() || roomCodeInput.length < 4}
              onClick={() => onJoinRoom(roomCodeInput.trim())}
            >
              JOIN ROOM
            </button>
          </div>

          <div className="divider">
            <span>OR PLAY SOLO</span>
          </div>

          {/* PvE Single-Player Block */}
          <div className="pve-block">
            <div className="pve-difficulty-selector">
              <span className="pve-label">BOT DIFFICULTY:</span>
              <div className="difficulty-pills">
                {['easy', 'medium', 'hard'].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    className={`diff-pill ${pveDifficulty === diff ? 'active' : ''}`}
                    onClick={() => setPveDifficulty(diff)}
                  >
                    {diff.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              id="btn-pve-mode"
              className="btn btn-pve"
              disabled={isLoading || !playerName.trim()}
              onClick={() => onStartPve(pveDifficulty)}
            >
              <span className="btn-icon">🤖</span>
              <span>PLAY VS COMPUTER</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
