// ─── Pusher Client Singleton (browser-only) ───────────────────────────────────
// Lazily initialised on first call — safe to import from any Client Component.
// Environment variables required (exposed to the browser via NEXT_PUBLIC_ prefix):
//   NEXT_PUBLIC_PUSHER_KEY
//   NEXT_PUBLIC_PUSHER_CLUSTER  (defaults to "mt1")

import Pusher from 'pusher-js';

let _pusherClient = null;

/**
 * Returns the shared pusher-js client instance.
 * Must only be called inside browser code (useEffect, event handlers, etc.).
 */
export function getPusherClient() {
  if (_pusherClient) return _pusherClient;

  const key     = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';

  if (!key) {
    console.error(
      '[Pusher] NEXT_PUBLIC_PUSHER_KEY is not set. ' +
      'Add it to your .env.local and Vercel dashboard.'
    );
    return null;
  }

  _pusherClient = new Pusher(key, {
    cluster,
    // Force WebSocket transport — avoids the slow HTTP long-polling fallback
    // that caused the latency issues with Socket.io on Vercel.
    enabledTransports: ['ws', 'wss'],
  });

  return _pusherClient;
}
