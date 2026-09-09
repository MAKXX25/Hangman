'use client';
import { useState, useEffect } from 'react';
import { DIFFICULTY_CONFIG } from '../lib/difficultyConfig.js';

/**
 * Team vs Team Lobby Component
 * Includes:
 * 1. Persistent nickname input with instant error reflection.
 * 2. Strict Unique Name Gatekeeper error trap (socket 'join_error' listener).
 * 3. Glassmorphic Team Selection buttons (Team A vs Team B).
 * 4. Room Code input and solo PvE options.
 */
export default function Lobby({
  playerName = '',
  setPlayerName,
  onCreateRoom,
  onJoinRoom,
  onStartPve,
  errorMsg = '',
  isLoading = false,
  socket = null,
}) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('teamB');
  const [pveDifficulty, setPveDifficulty] = useState('medium');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(isLoading);

  // Synchronize loading prop with internal state
  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Clear errors when the user edits their name
  const handleNameChange = (val) => {
    setPlayerName(val);
    if (joinError) setJoinError('');
  };

  // ── Unique Name Gatekeeper Error Trap ───────────────────────────────────────
  // Listens for 'join_error' emitted by backend when room name collision occurs
  useEffect(() => {
    if (!socket || typeof socket.on !== 'function') return;

    const handleJoinError = (err) => {
      setLoading(false);
      const message =
        typeof err === 'string'
          ? err
          : err?.message || 'Name already taken in this room. Please choose another.';
      setJoinError(message);
    };

    socket.on('join_error', handleJoinError);

    return () => {
      if (typeof socket.off === 'function') {
        socket.off('join_error', handleJoinError);
      }
    };
  }, [socket]);

  const handleJoinSubmit = () => {
    setJoinError('');
    if (!playerName.trim()) {
      setJoinError('Please enter your nickname first.');
      return;
    }
    if (!roomCodeInput.trim() || roomCodeInput.trim().length < 4) {
      setJoinError('Please enter a valid 5-6 character room code.');
      return;
    }
    setLoading(true);
    if (typeof onJoinRoom === 'function') {
      onJoinRoom(roomCodeInput.trim(), selectedTeam);
    }
  };

  const handleCreateSubmit = () => {
    setJoinError('');
    if (!playerName.trim()) {
      setJoinError('Please enter your nickname first.');
      return;
    }
    setLoading(true);
    if (typeof onCreateRoom === 'function') {
      onCreateRoom(selectedTeam);
    }
  };

  const activeError = joinError || errorMsg;

  return (
    <div className="screen active" id="screen-lobby">
      <div className="lobby-card glass">
        {/* Header */}
        <div className="lobby-header">
          <div className="game-badge">⚡ TEAM VS TEAM DUEL (UP TO 4V4)</div>
          <h1 className="game-title">
            HANGMAN <span className="title-accent">TEAMS</span>
          </h1>
          <p className="game-subtitle">
            Assemble your squad (Team A vs Team B) in an asymmetric neon word showdown.
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
              placeholder="Enter your unique name"
              maxLength={16}
              value={playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              autoComplete="off"
              className={activeError ? 'input-error-border' : ''}
            />
          </div>

          {/* ── High-Visibility Red Error Block for Duplicate Name / Join Errors ── */}
          {activeError && (
            <div
              id="duplicate-name-error"
              className="mt-2.5 p-3 rounded-xl bg-red-950/90 border border-red-500/70 text-red-200 text-xs font-semibold flex items-center gap-2.5 shadow-lg shadow-red-950/50 animate-shake"
              role="alert"
            >
              <span className="text-base flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="leading-snug">{activeError}</p>
                <span className="text-[11px] text-red-300/80 font-normal">
                  Usernames must be unique within the same room. Please pick a different name.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions Grid */}
        <div className="lobby-actions">
          {/* Create Room Button */}
          <button
            id="btn-create-room"
            className="btn btn-primary btn-glow"
            disabled={loading || !playerName.trim()}
            onClick={handleCreateSubmit}
          >
            <span className="btn-icon">⚡</span>
            <span>{loading ? 'CREATING SQUAD ROOM…' : 'CREATE TEAM ROOM (HOST)'}</span>
          </button>

          <div className="divider">
            <span>OR JOIN SQUAD WITH CODE</span>
          </div>

          {/* ── Glassmorphism Team Selection Buttons ── */}
          <div className="team-select-container">
            <label className="team-select-label">SELECT YOUR TEAM:</label>
            <div className="team-buttons-grid">
              {/* Team A Button */}
              <button
                type="button"
                id="btn-team-a"
                className={`team-glass-btn team-a ${selectedTeam === 'teamA' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('teamA')}
              >
                <div className="team-btn-header">
                  <span className="team-icon">🛡️</span>
                  <span className="team-name">TEAM A</span>
                </div>
                <span className="team-sub">Word Setters (Max 4)</span>
                {selectedTeam === 'teamA' && <span className="team-selected-pill">SELECTED</span>}
              </button>

              {/* Team B Button */}
              <button
                type="button"
                id="btn-team-b"
                className={`team-glass-btn team-b ${selectedTeam === 'teamB' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('teamB')}
              >
                <div className="team-btn-header">
                  <span className="team-icon">⚔️</span>
                  <span className="team-name">TEAM B</span>
                </div>
                <span className="team-sub">Challengers (Max 4)</span>
                {selectedTeam === 'teamB' && <span className="team-selected-pill">SELECTED</span>}
              </button>
            </div>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinSubmit();
              }}
              autoComplete="off"
            />
            <button
              id="btn-join-room"
              className="btn btn-secondary"
              disabled={loading || !playerName.trim() || roomCodeInput.length < 4}
              onClick={handleJoinSubmit}
            >
              {loading ? 'JOINING…' : `JOIN ${selectedTeam === 'teamA' ? 'TEAM A' : 'TEAM B'}`}
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
                {Object.values(DIFFICULTY_CONFIG).map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    className={`diff-pill ${pveDifficulty === cfg.id ? 'active' : ''}`}
                    onClick={() => setPveDifficulty(cfg.id)}
                  >
                    {cfg.id.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <button
              id="btn-pve-mode"
              className="btn btn-pve"
              disabled={loading || !playerName.trim()}
              onClick={() => onStartPve && onStartPve(pveDifficulty)}
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
