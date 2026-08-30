import { NextResponse } from 'next/server';
import { generateRoomCode, saveRoom } from '../../../../lib/roomsStore.js';
import { createInitialRoom } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { playerName, wordPickTime, playerId } = await req.json();
    const name   = (playerName || 'Player 1').trim().slice(0, 20);
    // Use the client-provided stable playerId so Pusher events can target them correctly.
    const pid    = (playerId || 'player_1').trim();
    const roomCode = generateRoomCode();

    const room = createInitialRoom(roomCode, name, wordPickTime || 60);
    // Override the default 'player_1' id with the client's stable session id.
    if (room.players[0]) room.players[0].id = pid;
    saveRoom(roomCode, room);

    return NextResponse.json({ success: true, roomCode, room, playerId: pid });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
