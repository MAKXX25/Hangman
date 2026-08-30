import { NextResponse } from 'next/server';
import Pusher from 'pusher';

// Initialize Pusher Server SDK
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER || 'mt1',
  useTLS: true,
});

export async function POST(req) {
  try {
    const { roomId, event, payload } = await req.json();

    if (!roomId || !event) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: roomId and event' },
        { status: 400 }
      );
    }

    // Trigger the real-time event on the roomId channel
    // e.g. pusher.trigger("room-ABC123", "letter_guessed", payload)
    const channelName = roomId.startsWith('room-') ? roomId : `room-${roomId}`;
    await pusher.trigger(channelName, event, payload || {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pusher Trigger Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to trigger event' },
      { status: 500 }
    );
  }
}
