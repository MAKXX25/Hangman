import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { startRound } from '../../../../lib/gameLogic.js';

export async function POST(req) {
  try {
    const { roomCode, playerName } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();
    const name = (playerName || 'Player 2').trim().slice(0, 16);

    const room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found. Check the code.' }, { status: 404 });
    }

    if (room.players.length >= 2) {
      return NextResponse.json({ success: false, error: 'Room is already full.' }, { status: 400 });
    }

    const playerId = 'player_2';
    room.players.push({ id: playerId, name, score: 0, isReady: true });

    // Both players present: start setting phase!
    const activeRoom = startRound(room, 0);
    saveRoom(cleanCode, activeRoom);

    return NextResponse.json({ success: true, room: activeRoom, playerId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
