import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { processGuess } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { roomCode, letter } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const cleanLetter = (letter || '').toUpperCase().trim();

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    const updatedRoom = processGuess(room, cleanLetter);
    saveRoom(cleanCode, updatedRoom);

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
