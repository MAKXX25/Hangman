import { NextResponse } from 'next/server';
import { generateRoomCode, saveRoom } from '../../../../lib/roomsStore.js';
import { createInitialRoom } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { playerName, wordPickTime } = await req.json();
    const name = (playerName || 'Player 1').trim().slice(0, 20);
    const roomCode = generateRoomCode();

    const room = createInitialRoom(roomCode, name, wordPickTime || 60);
    saveRoom(roomCode, room);

    return NextResponse.json({ success: true, roomCode, room, playerId: 'player_1' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
