'use client';

import React, { useState } from 'react';
import { Users, Crown, Check, Shuffle, Share2, Copy, MessageCircle, LogOut } from 'lucide-react';

export default function WaitingRoomUI({
  roomCode,
  teamA = [],
  teamB = [],
  teamNameA = 'Team A',
  teamNameB = 'Team B',
  leaderA,
  leaderB,
  currentSocketId,
  myPlayerId,
  myTeam = null,
  isHost,
  onToggleReady,
  onSetTeamName,
  onAssignLeader,
  onSwitchTeam,
  onLeaveRoom,
  copyRoomCode,
  copyInviteLink,
  shareViaWhatsApp,
  liveTriviaFact,
  isFactFading,
  suggestedNames = [],
  onRerollNames,
}) {
  const [customNameA, setCustomNameA] = useState('');
  const [customNameB, setCustomNameB] = useState('');

  const allPlayers = [...teamA, ...teamB];
  const myPlayer = allPlayers.find(
    (p) => p.sessionId === myPlayerId || p.socketId === currentSocketId || p.isYou
  );
  const isMyPlayerReady = !!myPlayer?.isReady;

  const isLeaderA = !!(currentSocketId && leaderA && currentSocketId === leaderA);
  const isLeaderB = !!(currentSocketId && leaderB && currentSocketId === leaderB);

  const readyCount = allPlayers.filter((p) => p.isReady).length;
  const totalCount = allPlayers.length;
  const canStartMatch = teamA.length > 0 && teamB.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 flex flex-col items-center gap-6 z-10 animate-fadeIn">
      {/* ─── Top Header & Room Code Bar ───────────────────────────────── */}
      <div className="w-full bg-[#11101e]/90 backdrop-blur-xl border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-white/20 flex items-center justify-center text-xl shadow-inner">
            <span>🛡️</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-wider text-white">
                Team Duel Lobby
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
                WAITING PHASE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Ready up to start the duel • Team leaders can set custom team names
            </p>
          </div>
        </div>

        {/* Room Code & Quick Share */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div
            onClick={copyRoomCode}
            title="Click to copy room code"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-950/80 border border-purple-500/40 cursor-pointer hover:border-purple-400 transition-all group"
          >
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">ROOM:</span>
            <span className="font-mono text-lg font-black tracking-widest text-purple-300 group-hover:text-purple-200">
              {roomCode}
            </span>
            <Copy className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>

          <button
            type="button"
            onClick={copyInviteLink}
            title="Copy Invite Link"
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={shareViaWhatsApp}
            title="Share on WhatsApp"
            className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          {typeof onLeaveRoom === 'function' && (
            <button
              type="button"
              onClick={onLeaveRoom}
              title="Leave Room"
              className="p-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Two-Column Split Screen: Team A vs Team B ────────────────── */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        
        {/* ─── COLUMN 1: TEAM A ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-[#121124]/90 border border-cyan-500/30 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            {/* Team A Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛡️</span>
                <div>
                  <h3 className="font-display font-black text-base sm:text-lg text-cyan-300 uppercase tracking-wide truncate max-w-[200px]">
                    {teamNameA || 'Team A'}
                  </h3>
                  <span className="text-[11px] text-cyan-400/70 font-mono">Word Setters (Round 1)</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                {teamA.length} / 4 Players
              </span>
            </div>

            {/* Team A Players Roster */}
            <div className="flex flex-col gap-2 min-h-[140px]">
              {teamA.length > 0 ? (
                teamA.map((p) => {
                  const isYou = p.sessionId === myPlayerId || p.socketId === currentSocketId || p.isYou;
                  const isLeader = p.isLeader || (p.socketId && p.socketId === leaderA);
                  const isReady = !!p.isReady;

                  return (
                    <div
                      key={p.sessionId || p.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all ${
                        isYou
                          ? 'bg-cyan-500/20 border border-cyan-400/60 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Ready Status Indicator: Glowing Green Check vs Gray Dot */}
                        {isReady ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center flex-shrink-0" title="Ready!">
                            <Check className="w-3.5 h-3.5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0" title="Not Ready">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 ring-2 ring-slate-800" />
                          </div>
                        )}

                        {/* Leader Crown Badge */}
                        {isLeader && (
                          <span title="Team Captain" className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] animate-pulse">
                            👑
                          </span>
                        )}

                        {/* Host Badge */}
                        {p.isHost && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 border border-purple-400/40 font-mono font-bold">
                            HOST
                          </span>
                        )}

                        <span className="truncate font-semibold">{p.name}</span>
                        {isYou && <span className="text-[10px] text-cyan-300 font-mono font-bold">(You)</span>}
                      </div>

                      {/* Ready State Label or Host Leader Switch */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${isReady ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isReady ? 'READY' : 'WAITING'}
                        </span>

                        {isHost && !isLeader && (
                          <button
                            type="button"
                            onClick={() => onAssignLeader(p.socketId, 'teamA')}
                            className="text-[9px] px-2 py-0.5 rounded bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                            title={`Make ${p.name} Captain`}
                          >
                            Make Captain
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-white/10 rounded-2xl p-6">
                  No players in Team A yet...
                </div>
              )}
            </div>
          </div>

          {/* ─── Team Name Chooser for Leader A (Placed Directly Under Team A Roster) ─── */}
          {isLeaderA && (
            <div className="p-4 sm:p-5 rounded-3xl bg-[#141228]/95 border border-cyan-500/40 backdrop-blur-xl shadow-xl flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-base">👑</span>
                  <h4 className="font-display font-bold text-xs sm:text-sm text-cyan-200 uppercase tracking-wide">
                    Captain Controls: Set Team A Name
                  </h4>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                  LEADER A
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter custom Team A name..."
                  maxLength={30}
                  value={customNameA}
                  onChange={(e) => setCustomNameA(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customNameA.trim()) {
                      onSetTeamName('teamA', customNameA.trim());
                      setCustomNameA('');
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/60 border border-cyan-500/30 focus:border-cyan-400 text-white placeholder-slate-400 text-xs font-medium outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customNameA.trim()) {
                      onSetTeamName('teamA', customNameA.trim());
                      setCustomNameA('');
                    }
                  }}
                  disabled={!customNameA.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  Set Name
                </button>
              </div>

              {/* 4 Suggested Names Chips */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>SUGGESTED NAMES:</span>
                  <button
                    type="button"
                    onClick={onRerollNames}
                    className="text-cyan-300 hover:text-cyan-200 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Reroll</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {suggestedNames.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetTeamName('teamA', name)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-400/50 text-cyan-200 text-xs truncate transition-all text-left cursor-pointer"
                      title={`Select "${name}"`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── COLUMN 2: TEAM B ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-[#121124]/90 border border-purple-500/30 backdrop-blur-xl shadow-xl flex flex-col gap-4">
            {/* Team B Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚔️</span>
                <div>
                  <h3 className="font-display font-black text-base sm:text-lg text-purple-300 uppercase tracking-wide truncate max-w-[200px]">
                    {teamNameB || 'Team B'}
                  </h3>
                  <span className="text-[11px] text-purple-400/70 font-mono">Challengers & Guessers (Round 1)</span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-400/15 text-purple-300 border border-purple-400/30">
                {teamB.length} / 4 Players
              </span>
            </div>

            {/* Team B Players Roster */}
            <div className="flex flex-col gap-2 min-h-[140px]">
              {teamB.length > 0 ? (
                teamB.map((p) => {
                  const isYou = p.sessionId === myPlayerId || p.socketId === currentSocketId || p.isYou;
                  const isLeader = p.isLeader || (p.socketId && p.socketId === leaderB);
                  const isReady = !!p.isReady;

                  return (
                    <div
                      key={p.sessionId || p.id}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all ${
                        isYou
                          ? 'bg-purple-500/20 border border-purple-400/60 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : 'bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {/* Ready Status Indicator: Glowing Green Check vs Gray Dot */}
                        {isReady ? (
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center flex-shrink-0" title="Ready!">
                            <Check className="w-3.5 h-3.5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 flex items-center justify-center flex-shrink-0" title="Not Ready">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 ring-2 ring-slate-800" />
                          </div>
                        )}

                        {/* Leader Crown Badge */}
                        {isLeader && (
                          <span title="Team Captain" className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] animate-pulse">
                            👑
                          </span>
                        )}

                        {/* Host Badge */}
                        {p.isHost && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 border border-purple-400/40 font-mono font-bold">
                            HOST
                          </span>
                        )}

                        <span className="truncate font-semibold">{p.name}</span>
                        {isYou && <span className="text-[10px] text-purple-300 font-mono font-bold">(You)</span>}
                      </div>

                      {/* Ready State Label or Host Leader Switch */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${isReady ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {isReady ? 'READY' : 'WAITING'}
                        </span>

                        {isHost && !isLeader && (
                          <button
                            type="button"
                            onClick={() => onAssignLeader(p.socketId, 'teamB')}
                            className="text-[9px] px-2 py-0.5 rounded bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                            title={`Make ${p.name} Captain`}
                          >
                            Make Captain
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-white/10 rounded-2xl p-6">
                  No players in Team B yet... Share room code to invite!
                </div>
              )}
            </div>
          </div>

          {/* ─── Team Name Chooser for Leader B (Placed Directly Under Team B Roster) ─── */}
          {isLeaderB && (
            <div className="p-4 sm:p-5 rounded-3xl bg-[#141228]/95 border border-purple-500/40 backdrop-blur-xl shadow-xl flex flex-col gap-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-base">👑</span>
                  <h4 className="font-display font-bold text-xs sm:text-sm text-purple-200 uppercase tracking-wide">
                    Captain Controls: Set Team B Name
                  </h4>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-purple-400/15 text-purple-300 border border-purple-400/30">
                  LEADER B
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter custom Team B name..."
                  maxLength={30}
                  value={customNameB}
                  onChange={(e) => setCustomNameB(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customNameB.trim()) {
                      onSetTeamName('teamB', customNameB.trim());
                      setCustomNameB('');
                    }
                  }}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/60 border border-purple-500/30 focus:border-purple-400 text-white placeholder-slate-400 text-xs font-medium outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customNameB.trim()) {
                      onSetTeamName('teamB', customNameB.trim());
                      setCustomNameB('');
                    }
                  }}
                  disabled={!customNameB.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                >
                  Set Name
                </button>
              </div>

              {/* 4 Suggested Names Chips */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>SUGGESTED NAMES:</span>
                  <button
                    type="button"
                    onClick={onRerollNames}
                    className="text-purple-300 hover:text-purple-200 transition-colors flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Reroll</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {suggestedNames.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSetTeamName('teamB', name)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-400/50 text-purple-200 text-xs truncate transition-all text-left cursor-pointer"
                      title={`Select "${name}"`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ─── Team Switcher: Choose / Switch Your Team ─────────────────── */}
      {typeof onSwitchTeam === 'function' && (
        <div className="w-full max-w-2xl animate-fadeIn">
          <div className="p-4 sm:p-5 rounded-3xl bg-[#0f0f1e]/95 border border-white/10 backdrop-blur-xl shadow-xl flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🔀</span>
              <h4 className="font-display font-bold text-sm text-white uppercase tracking-wide">
                Choose Your Team
              </h4>
              <span className="ml-auto text-[10px] font-mono text-slate-500">You can switch before the game starts</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Team A Switch Button */}
              <button
                type="button"
                id="btn-switch-team-a"
                disabled={myTeam === 'teamA' || teamA.length >= 4}
                onClick={() => onSwitchTeam('teamA')}
                className={`relative p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 text-left ${
                  myTeam === 'teamA'
                    ? 'bg-cyan-500/20 border-cyan-400 ring-1 ring-cyan-400/50 cursor-default'
                    : teamA.length >= 4
                    ? 'bg-white/[0.02] border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/50 cursor-pointer active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-1.5 text-cyan-300">🛡️ {teamNameA || 'Team A'}</span>
                  {myTeam === 'teamA' && (
                    <span className="text-[9px] font-mono font-black bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-400/40">YOU</span>
                  )}
                  {teamA.length >= 4 && myTeam !== 'teamA' && (
                    <span className="text-[9px] font-mono font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">FULL</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">Word Setters · {teamA.length}/4 players</span>
                {myTeam !== 'teamA' && teamA.length < 4 && (
                  <span className="text-[10px] font-bold text-cyan-400 mt-0.5">→ Switch to this team</span>
                )}
              </button>

              {/* Team B Switch Button */}
              <button
                type="button"
                id="btn-switch-team-b"
                disabled={myTeam === 'teamB' || teamB.length >= 4}
                onClick={() => onSwitchTeam('teamB')}
                className={`relative p-3.5 rounded-2xl border transition-all flex flex-col gap-1.5 text-left ${
                  myTeam === 'teamB'
                    ? 'bg-purple-500/20 border-purple-400 ring-1 ring-purple-400/50 cursor-default'
                    : teamB.length >= 4
                    ? 'bg-white/[0.02] border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 hover:bg-purple-500/10 hover:border-purple-500/50 cursor-pointer active:scale-[0.98]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm flex items-center gap-1.5 text-purple-300">⚔️ {teamNameB || 'Team B'}</span>
                  {myTeam === 'teamB' && (
                    <span className="text-[9px] font-mono font-black bg-purple-400/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/40">YOU</span>
                  )}
                  {teamB.length >= 4 && myTeam !== 'teamB' && (
                    <span className="text-[9px] font-mono font-black bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">FULL</span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">Challengers · {teamB.length}/4 players</span>
                {myTeam !== 'teamB' && teamB.length < 4 && (
                  <span className="text-[10px] font-bold text-purple-400 mt-0.5">→ Switch to this team</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom Center: Massive Glowing READY UP Button ──────────── */}
      <div className="w-full max-w-lg flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          id="btn-ready-up"
          onClick={onToggleReady}
          className={`w-full py-4 px-8 rounded-2xl font-display font-black text-lg sm:text-xl uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer select-none ${
            isMyPlayerReady
              ? 'bg-white/10 hover:bg-white/15 text-slate-300 border border-white/20 shadow-lg hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:shadow-[0_0_50px_rgba(16,185,129,0.8)] hover:scale-[1.03] active:scale-[0.98] animate-pulse'
          }`}
        >
          {isMyPlayerReady ? (
            <>
              <Check className="w-6 h-6 text-emerald-400" />
              <span>UNREADY</span>
            </>
          ) : (
            <>
              <span className="text-2xl">⚡</span>
              <span>READY UP</span>
            </>
          )}
        </button>

        {/* Ready Progress Counter & Helper Text */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300 font-bold">
              READY STATUS: {readyCount}/{totalCount} PLAYERS READY
            </span>
            {readyCount === totalCount && canStartMatch && (
              <span className="text-xs text-emerald-400 font-bold animate-pulse">
                • Launching Duel...
              </span>
            )}
          </div>
          {!canStartMatch && (
            <p className="text-[11px] text-amber-300/80 font-medium">
              ⚠️ Both Team A and Team B require at least 1 player to launch.
            </p>
          )}
        </div>
      </div>

      {/* ─── Trivia Card & Leave Room ─────────────────────────────────── */}
      <div className="w-full max-w-lg flex flex-col items-center gap-3">
        {liveTriviaFact && (
          <div className="w-full p-3.5 rounded-2xl bg-purple-950/30 border border-purple-500/20 backdrop-blur-md flex flex-col items-center gap-1 text-center">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-yellow-300">
              💡 DID YOU KNOW?
            </span>
            <p className={`text-xs text-slate-300 transition-opacity duration-300 ${isFactFading ? 'opacity-0' : 'opacity-100'}`}>
              &ldquo;{liveTriviaFact}&rdquo;
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onLeaveRoom}
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
}
