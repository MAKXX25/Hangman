import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { isValidWord } from '../../../../lib/dictionary.js';
import { applyWordChoice } from '../../../../lib/gameLogic.js';
import { triggerRoomEvent } from '../../../../lib/pusherServer.js';

export async function POST(req) {
  try {
    const { roomCode, word } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const cleanWord = (word || '').toUpperCase().trim();

    if (!cleanWord || !/^[A-Z]+$/.test(cleanWord) || cleanWord.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Word must be at least 2 letters and contain only letters.' },
        { status: 400 }
      );
    }

    if (!isValidWord(cleanWord)) {
      return NextResponse.json(
        { success: false, error: `"${cleanWord}" is not in the English dictionary.` },
        { status: 400 }
      );
    }

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    if (room.state !== 'setting') {
      return NextResponse.json({ success: false, error: 'Not the right time to set a word.' }, { status: 400 });
    }

    const updatedRoom = applyWordChoice(room, cleanWord);
    saveRoom(cleanCode, updatedRoom);

    // ── Pusher: word is valid — tell the setter their word was accepted ───────
    await triggerRoomEvent(cleanCode, 'word_validation', { valid: true, reason: '' });

    // ── Pusher: notify both players the guessing phase is starting ───────────
    await triggerRoomEvent(cleanCode, 'round_started', {
      wordLength:    cleanWord.length,
      wordSetterId:  updatedRoom.game.wordSetterId,
      guesserId:     updatedRoom.game.guesserId,
    });

    // ── Pusher: broadcast full game state (guesser sees hidden word) ──────────
    await triggerRoomEvent(cleanCode, 'state_update', updatedRoom);

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
