import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { processGuess } from '../../../../lib/gameLogic.js';
import { triggerRoomEvent } from '../../../../lib/pusherServer.js';

export async function POST(req) {
  try {
    const { roomCode, letter } = await req.json();
    const cleanCode   = (roomCode || '').toUpperCase().trim();
    const cleanLetter = (letter  || '').toUpperCase().trim();

    if (!cleanLetter || !/^[A-Z]$/.test(cleanLetter)) {
      return NextResponse.json({ success: false, error: 'Invalid letter.' }, { status: 400 });
    }

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.state !== 'guessing') {
      return NextResponse.json({ success: false, error: 'No active guessing phase.' }, { status: 400 });
    }

    if (room.game?.guessedLetters?.includes(cleanLetter)) {
      return NextResponse.json({ success: false, error: `"${cleanLetter}" was already guessed.` }, { status: 400 });
    }

    const updatedRoom = processGuess(room, cleanLetter);
    saveRoom(cleanCode, updatedRoom);

    // ── Pusher: broadcast updated state to both players instantly ─────────────
    await triggerRoomEvent(cleanCode, 'state_update', updatedRoom);

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
