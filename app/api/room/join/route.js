import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { startRound } from '../../../../lib/gameLogic.js';
import { getRandomSuggestions } from '../../../../lib/dictionary.js';
import { triggerRoomEvent } from '../../../../lib/pusherServer.js';

export async function POST(req) {
  try {
    const { roomCode, playerName, playerId } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const name = (playerName || 'Player 2').trim().slice(0, 16);
    // Accept a client-provided playerId so Pusher events can target the right player.
    const id = (playerId || 'player_2').trim();

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found. Check the code.' }, { status: 404 });
    }

    if (room.players.length >= 2) {
      return NextResponse.json({ success: false, error: 'Room is already full.' }, { status: 400 });
    }

    room.players.push({ id, name, score: 0, isReady: true });

    // Both players present: start the setting phase (player[0] = word setter).
    const activeRoom = startRound(room, 0);
    saveRoom(cleanCode, activeRoom);

    // ── Pusher: notify both players that the game has started ────────────────
    await triggerRoomEvent(cleanCode, 'game_start', {
      roomCode: cleanCode,
      wordSetterId: activeRoom.game.wordSetterId,
      guesserId:    activeRoom.game.guesserId,
      players:      activeRoom.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    // ── Pusher: broadcast initial game state to both players ─────────────────
    await triggerRoomEvent(cleanCode, 'state_update', activeRoom);

    // ── Pusher: send word suggestions to the channel (both receive; the
    //    word setter uses them, the guesser ignores them) ────────────────────
    await triggerRoomEvent(cleanCode, 'word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });

    return NextResponse.json({ success: true, room: activeRoom, playerId: id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
