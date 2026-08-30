import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { startRound } from '../../../../lib/gameLogic.js';
import { getRandomSuggestions } from '../../../../lib/dictionary.js';
import { triggerRoomEvent } from '../../../../lib/pusherServer.js';

export async function POST(req) {
  try {
    const { roomCode } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.state !== 'roundover') {
      return NextResponse.json({ success: false, error: 'Round is not over yet.' }, { status: 400 });
    }

    // Determine next setter index (swap roles each round)
    let currentSetterIdx = 0;
    if (room.game?.wordSetterId && room.players) {
      const idx = room.players.findIndex(p => p.id === room.game.wordSetterId);
      if (idx !== -1) currentSetterIdx = idx;
    }
    const nextSetterIdx = (currentSetterIdx + 1) % room.players.length;

    const nextRoom = startRound(room, nextSetterIdx);
    saveRoom(cleanCode, nextRoom);

    // ── Pusher: tell both players to clear round-over UI immediately ──────────
    await triggerRoomEvent(cleanCode, 'round_transitioning', {
      state:        'setting',
      wordSetterId: nextRoom.game.wordSetterId,
    });

    // ── Pusher: broadcast full new-round state ────────────────────────────────
    await triggerRoomEvent(cleanCode, 'state_update', nextRoom);

    // ── Pusher: send fresh word suggestions for the new word setter ───────────
    await triggerRoomEvent(cleanCode, 'word_suggestions', {
      suggestions: getRandomSuggestions(12),
    });

    return NextResponse.json({ success: true, room: nextRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
