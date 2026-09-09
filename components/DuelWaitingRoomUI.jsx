'use client';

import React, { useState } from 'react';
import { Crown, Swords, Copy, Share2, MessageCircle, LogOut, Check, Clock } from 'lucide-react';
import { playMechanicalClick } from '../lib/audio.js';

export default function DuelWaitingRoomUI({
  roomCode,
  teamA = [],
  teamB = [],
  currentSocketId,
  myPlayerId,
  isHost,
  onToggleReady,
  onLeaveRoom,
  copyRoomCode,
  copyInviteLink,
  shareViaWhatsApp,
  liveTriviaFact,
  isFactFading,
}) {
  const [copiedLinkRecently, setCopiedLinkRecently] = useState(false);

  const allPlayers = [...(teamA || []), ...(teamB || [])];
  const hostPlayer = teamA[0] || allPlayers.find((p) => p.isHost) || allPlayers[0] || null;
  const opponentPlayer = teamB[0] || allPlayers.find((p) => p !== hostPlayer) || null;
  const hasOpponent = !!opponentPlayer;

  const myPlayer = allPlayers.find(
    (p) => p.sessionId === myPlayerId || p.socketId === currentSocketId || p.isYou
  );
  const isMyPlayerReady = !!myPlayer?.isReady;
  const isHostReady = !!hostPlayer?.isReady;
  const isOpponentReady = !!opponentPlayer?.isReady;
  const bothReady = hasOpponent && isHostReady && isOpponentReady;

  const isCurrentPlayerHost = !!(myPlayer && (myPlayer.isHost || myPlayer === hostPlayer));

  const handleCopyLinkClick = () => {
    playMechanicalClick();
    if (copyInviteLink) copyInviteLink();
    setCopiedLinkRecently(true);
    setTimeout(() => setCopiedLinkRecently(false), 2500);
  };

  const handleShareWhatsAppClick = () => {
    playMechanicalClick();
    if (shareViaWhatsApp) shareViaWhatsApp();
  };

  const handleToggleReadyClick = () => {
    playMechanicalClick();
    if (onToggleReady) onToggleReady();
  };

  const handleLeaveClick = () => {
    playMechanicalClick();
    if (onLeaveRoom) onLeaveRoom();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-3 sm:py-4 flex flex-col items-center gap-5 sm:gap-6 z-10 animate-fadeIn">
      {/* ─── Top Header & Room Code Bar ───────────────────────────────── */}
      <div className="w-full bg-[#11101e]/90 backdrop-blur-xl border border-white/15 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-violet-500/25 via-purple-500/20 to-fuchsia-500/20 border border-purple-500/30 flex items-center justify-center text-xl shadow-inner flex-shrink-0">
            <span>⚔️</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black font-display uppercase tracking-wider text-white">
                1v1 Duel Lobby
              </h2>
              {hasOpponent ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  FIGHTERS READY
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  WAITING FOR OPPONENT
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Host vs Challenger • Round 1: Word Setter vs Guesser
            </p>
          </div>
        </div>

        {/* Right Action Icons: Code Badge, Copy, WhatsApp, Leave */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => {
              playMechanicalClick();
              if (copyRoomCode) copyRoomCode();
            }}
            className="bg-[#0a0a0f]/80 border border-white/15 hover:border-purple-400 px-3 py-2 rounded-xl transition-all cursor-pointer group flex items-center gap-2 text-xs"
            title="Click to copy room code"
            type="button"
          >
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Room:</span>
            <span className="font-mono font-bold text-white tracking-widest text-sm">{roomCode}</span>
            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-300 transition-colors" />
          </button>

          <button
            onClick={handleCopyLinkClick}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              copiedLinkRecently
                ? 'bg-purple-600 border-purple-400 text-white'
                : 'bg-[#0a0a0f]/80 border-white/15 hover:border-purple-400 text-slate-300 hover:text-white'
            }`}
            title="Copy Invite Link"
            type="button"
          >
            {copiedLinkRecently ? <Check className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />}
          </button>

          <button
            onClick={handleShareWhatsAppClick}
            className="p-2.5 bg-[#0a0a0f]/80 border border-white/15 hover:border-emerald-400 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all cursor-pointer flex items-center justify-center"
            title="Share on WhatsApp"
            type="button"
          >
            <MessageCircle className="w-4 h-4" />
          </button>

          <button
            onClick={handleLeaveClick}
            className="p-2.5 bg-[#0a0a0f]/80 border border-white/15 hover:border-red-500/60 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-all cursor-pointer flex items-center justify-center ml-1"
            title="Leave Lobby"
            type="button"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Centerpiece: 1v1 Head-to-Head Arena ──────────────────────── */}
      <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6">
        
        {/* ── PLAYER 1 / HOST (Word Setter R1) ─────────────────────────── */}
        <div className="bg-gradient-to-b from-[#16132d]/95 via-[#110e24]/95 to-[#0c0a1a]/95 border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          
          {/* Host & Role Badge */}
          <div className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 mb-5 shadow-sm">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Host • Word Setter (R1)</span>
          </div>

          {/* Large Avatar Emblem */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-violet-600/30 via-purple-700/25 to-fuchsia-600/30 border-2 border-purple-400/50 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-purple-900/40 mb-4 relative">
            <span className="font-display font-black text-purple-200">
              {hostPlayer?.name ? hostPlayer.name.slice(0, 2).toUpperCase() : 'H'}
            </span>
            {isHostReady && (
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#110e24] flex items-center justify-center text-white shadow-md">
                <Check className="w-4 h-4 stroke-[3]" />
              </span>
            )}
          </div>

          {/* Player Name */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl sm:text-2xl font-bold font-display text-white tracking-wide">
              {hostPlayer?.name || 'Host'}
            </h3>
            {isCurrentPlayerHost && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40">
                You
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-4">Will pick the mystery word first</p>

          {/* Status Badge */}
          {isHostReady ? (
            <div className="px-4 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950/40">
              <Check className="w-3.5 h-3.5" />
              <span>READY TO DUEL</span>
            </div>
          ) : (
            <div className="px-4 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>IN LOBBY</span>
            </div>
          )}
        </div>

        {/* ── CENTER: ELECTRIC VS BADGE ───────────────────────────────── */}
        <div className="flex md:flex-col items-center justify-center gap-2 py-2 md:py-0">
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-br from-[#1b1538] via-[#120e26] to-[#090714] border border-purple-400/40 flex flex-col items-center justify-center shadow-2xl shadow-purple-900/50 relative group">
            <span className="text-2xl font-black font-display tracking-tighter bg-gradient-to-r from-amber-300 via-fuchsia-400 to-cyan-300 text-transparent bg-clip-text animate-pulse">
              VS
            </span>
            <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400 uppercase -mt-0.5">
              1v1
            </span>
          </div>
        </div>

        {/* ── PLAYER 2 / OPPONENT (Guesser R1) ────────────────────────── */}
        {hasOpponent ? (
          /* Opponent Joined Card */
          <div className="bg-gradient-to-b from-[#101b2f]/95 via-[#0c1527]/95 to-[#080d1a]/95 border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center relative overflow-hidden group hover:border-cyan-500/50 transition-all">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
            
            {/* Challenger & Role Badge */}
            <div className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 mb-5 shadow-sm">
              <Swords className="w-3.5 h-3.5 text-cyan-400" />
              <span>Challenger • Guesser (R1)</span>
            </div>

            {/* Large Avatar Emblem */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-cyan-600/30 via-blue-700/25 to-indigo-600/30 border-2 border-cyan-400/50 flex items-center justify-center text-3xl sm:text-4xl shadow-xl shadow-cyan-900/40 mb-4 relative">
              <span className="font-display font-black text-cyan-200">
                {opponentPlayer?.name ? opponentPlayer.name.slice(0, 2).toUpperCase() : 'C'}
              </span>
              {isOpponentReady && (
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#0c1527] flex items-center justify-center text-white shadow-md">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              )}
            </div>

            {/* Player Name */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl sm:text-2xl font-bold font-display text-white tracking-wide">
                {opponentPlayer?.name || 'Challenger'}
              </h3>
              {!isCurrentPlayerHost && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/25 text-cyan-300 border border-cyan-500/40">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-4">Will guess the mystery word first</p>

            {/* Status Badge */}
            {isOpponentReady ? (
              <div className="px-4 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-950/40">
                <Check className="w-3.5 h-3.5" />
                <span>READY TO DUEL</span>
              </div>
            ) : (
              <div className="px-4 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>NOT READY YET</span>
              </div>
            )}
          </div>
        ) : (
          /* Awaiting Challenger Card (Invite & Share Action) */
          <div className="bg-[#0f0e1c]/80 border-2 border-dashed border-white/15 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col items-center text-center relative overflow-hidden hover:border-purple-500/40 transition-all">
            <div className="px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 text-slate-400 border border-white/10 flex items-center gap-1.5 mb-5">
              <Swords className="w-3.5 h-3.5 text-slate-500" />
              <span>Challenger • Guesser (R1)</span>
            </div>

            {/* Pulsing Placeholder Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-inner mb-4 relative animate-pulse">
              <span className="text-slate-500">⏳</span>
              <div className="absolute inset-0 rounded-3xl border border-purple-500/30 animate-ping opacity-40" />
            </div>

            <h3 className="text-lg sm:text-xl font-bold font-display text-slate-200 tracking-wide mb-1">
              Awaiting Challenger…
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-5">
              Share your room code or invite link for an opponent to join
            </p>

            {/* Direct Quick Invite Buttons */}
            <div className="w-full flex flex-col gap-2.5 max-w-xs">
              <button
                onClick={handleCopyLinkClick}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                type="button"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedLinkRecently ? 'Link Copied! 📋' : 'Copy Invite Link'}</span>
              </button>

              <button
                onClick={handleShareWhatsAppClick}
                className="w-full py-2 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                type="button"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Ready / Start Action Controller ───────────────────── */}
      <div className="w-full max-w-md flex flex-col items-center gap-3 pt-2">
        {!hasOpponent ? (
          /* When waiting for opponent */
          <div className="w-full flex flex-col items-center gap-2">
            <button
              disabled
              className="w-full py-4 px-6 rounded-2xl font-bold font-display uppercase tracking-wider text-slate-400 bg-white/5 border border-white/10 flex items-center justify-center gap-2.5 cursor-not-allowed text-sm shadow-inner"
              type="button"
            >
              <Clock className="w-4 h-4 text-slate-500 animate-spin" />
              <span>Waiting for Challenger to Join…</span>
            </button>
            <p className="text-[11px] text-slate-400 text-center font-mono">
              Share link with Room Code <strong className="text-purple-300">{roomCode}</strong> to start
            </p>
          </div>
        ) : (
          /* When opponent is connected */
          <div className="w-full flex flex-col items-center gap-2">
            <button
              onClick={handleToggleReadyClick}
              className={`w-full py-4 px-8 rounded-2xl font-black font-display uppercase tracking-wider text-base sm:text-lg flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                isMyPlayerReady
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-violet-600 via-purple-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-purple-600/40 animate-pulse'
              }`}
              type="button"
            >
              {isMyPlayerReady ? (
                <>
                  <Check className="w-5 h-5 stroke-[3] text-emerald-200" />
                  <span>You Are Ready! (Click to cancel)</span>
                </>
              ) : (
                <>
                  <Swords className="w-5 h-5 text-amber-300" />
                  <span>Ready for Duel ⚔️</span>
                </>
              )}
            </button>

            {bothReady ? (
              <p className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5 animate-bounce">
                <span>🚀</span> Both fighters ready! Launching Duel Arena…
              </p>
            ) : isMyPlayerReady ? (
              <p className="text-xs font-mono text-amber-300/90 flex items-center gap-1.5 animate-pulse">
                <span>⏳</span> Waiting for opponent to ready up… Match will launch automatically!
              </p>
            ) : (
              <p className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <span>⚡</span> Click &quot;Ready for Duel&quot; when you are prepared to begin
              </p>
            )}
          </div>
        )}
      </div>

      {/* ─── Bottom Trivia / Fun Facts Bar ────────────────────────────── */}
      {liveTriviaFact && (
        <div className="w-full max-w-2xl bg-[#0e0d1a]/80 backdrop-blur-md border border-white/10 rounded-2xl px-5 py-3 text-center text-xs text-slate-300 shadow-xl flex items-center justify-center gap-2.5">
          <span className="text-base flex-shrink-0">💡</span>
          <span className={`transition-opacity duration-300 ${isFactFading ? 'opacity-0' : 'opacity-100'}`}>
            <strong className="text-purple-300 font-semibold">Hangman Fact:</strong> {liveTriviaFact}
          </span>
        </div>
      )}
    </div>
  );
}
