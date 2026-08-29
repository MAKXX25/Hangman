import { NextResponse } from 'next/server';
import { getRoom, saveRoom } from '../../../../lib/roomsStore.js';
import { getRandomWord } from '../../../../lib/dictionary.js';
import { applyWordChoice } from '../../../../lib/gameLogic.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const roomCode = searchParams.get('roomCode');
    const cleanCode = (roomCode || '').toUpperCase().trim();

    if (!cleanCode) {
      return NextResponse.json({ success: false, error: 'Missing roomCode' }, { status: 400 });
    }

    let room = getRoom(cleanCode);
    if (!room) {
      return NextResponse.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    // If room is in 'setting' phase, calculate dynamic timer countdown
    if (room.state === 'setting' && room.setterStartedAt) {
      const total = room.settings?.wordPickTime || 60;
      const elapsed = Math.floor((Date.now() - room.setterStartedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      room.timerSecondsLeft = remaining;
      room.timerTotal = total;

      // Auto-pick random word if time expired!
      if (remaining <= 0) {
        const autoWordObj = getRandomWord('medium');
        const autoWord = typeof autoWordObj === 'string' ? autoWordObj : autoWordObj.word;
        room = applyWordChoice(room, autoWord);
        saveRoom(cleanCode, room);
      }
    }

    return NextResponse.json({ success: true, room });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
