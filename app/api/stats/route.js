import { NextResponse } from 'next/server';
import {
  getGlobalStats,
  recordDuelPlayed,
  recordWordGuessed,
  recordGuess,
  updateActivePlayers
} from '../../../lib/roomsStore.js';

export async function GET() {
  try {
    const stats = getGlobalStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, isCorrect, activePlayers } = body;

    let updatedStats = getGlobalStats();

    if (action === 'record_duel') {
      updatedStats = recordDuelPlayed();
    } else if (action === 'record_win') {
      recordDuelPlayed();
      updatedStats = recordWordGuessed();
    } else if (action === 'record_guess') {
      updatedStats = recordGuess(Boolean(isCorrect));
    } else if (action === 'update_active') {
      updatedStats = updateActivePlayers(activePlayers);
    }

    return NextResponse.json({ success: true, stats: updatedStats });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
