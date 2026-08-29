import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { startRound } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { roomCode } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // Determine next setter index
    let currentSetterIdx = 0;
    if (room.game && room.game.wordSetterId && room.players) {
      const idx = room.players.findIndex(p => p.id === room.game.wordSetterId);
      if (idx !== -1) currentSetterIdx = idx;
    }
    const nextSetterIdx = (currentSetterIdx + 1) % room.players.length;

    const nextRoom = startRound(room, nextSetterIdx);
    saveRoom(cleanCode, nextRoom);

    return NextResponse.json({ success: true, room: nextRoom });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
