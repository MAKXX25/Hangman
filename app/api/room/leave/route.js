import { NextResponse } from 'next/server';
import { getRoom, deleteRoom, saveRoom } from '../../../../lib/roomsStore.js';

export async function POST(req) {
  try {
    const { roomCode, playerId } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: true });
    }

    // Filter out player
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.players.length === 0) {
      deleteRoom(cleanCode);
    } else {
      room.state = 'waiting';
      room.game = null;
      saveRoom(cleanCode, room);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
