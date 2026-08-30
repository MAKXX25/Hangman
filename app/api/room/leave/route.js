import { NextResponse } from 'next/server';
import { getRoom, deleteRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { triggerRoomEvent } from '../../../../lib/pusherServer.js';

export async function POST(req) {
  try {
    const { roomCode, playerId } = await req.json();
    const cleanCode = (roomCode || '').toUpperCase().trim();

    const room = getRoom(cleanCode);
    if (!room) {
      // Already gone — that's fine.
      return NextResponse.json({ success: true });
    }

    room.players = room.players.filter(p => p.id !== playerId);

    if (room.players.length === 0) {
      deleteRoom(cleanCode);
    } else {
      // Reset room to lobby state so the remaining player can wait for a new opponent.
      room.state = 'waiting';
      room.game  = null;
      saveRoom(cleanCode, room);

      // ── Pusher: notify the remaining player their opponent left ──────────────
      await triggerRoomEvent(cleanCode, 'opponent_left', { playerId });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
