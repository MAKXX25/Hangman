// ─── Pusher Server SDK Singleton ──────────────────────────────────────────────
// This file is ONLY imported by server-side Route Handlers (never the client bundle).
// Environment variables required (set in Vercel dashboard and .env.local):
//   PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER

import Pusher from 'pusher';

let _pusherInstance = null;

/**
 * Returns a shared Pusher server instance (created once per process).
 * Throws a descriptive error if any required env var is missing.
 */
function getPusherServer() {
  if (_pusherInstance) return _pusherInstance;

  const appId   = process.env.PUSHER_APP_ID;
  const key     = process.env.PUSHER_KEY;
  const secret  = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'mt1';

  if (!appId || !key || !secret) {
    throw new Error(
      'Pusher server env vars are missing. ' +
      'Set PUSHER_APP_ID, PUSHER_KEY, and PUSHER_SECRET in your Vercel dashboard / .env.local.'
    );
  }

  _pusherInstance = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return _pusherInstance;
}

/**
 * Broadcasts a Pusher event on a room channel.
 * Channel name convention: `room-${roomCode}` (e.g. "room-ABC123").
 *
 * @param {string} roomCode  The 6-character room code
 * @param {string} event     Pusher event name (e.g. "state_update")
 * @param {object} data      JSON-serialisable payload
 */
export async function triggerRoomEvent(roomCode, event, data) {
  try {
    const pusher = getPusherServer();
    await pusher.trigger(`room-${roomCode}`, event, data);
  } catch (err) {
    // Log but never throw — a Pusher delivery failure must NOT crash the API route.
    console.error(`[Pusher] Failed to trigger "${event}" on room-${roomCode}:`, err?.message);
  }
}
