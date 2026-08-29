import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { isValidWord } from '../../../../lib/dictionary.js';
import { applyWordChoice } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { roomCode, word } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const cleanWord = (word || '').toUpperCase().trim();

    if (!isValidWord(cleanWord)) {
      return NextResponse.json({ success: false, error: 'Word is not in English dictionary' }, { status: 400 });
    }

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const updatedRoom = applyWordChoice(room, cleanWord);
    saveRoom(cleanCode, updatedRoom);

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
