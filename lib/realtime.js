// Dual-mode Realtime Client (BroadcastChannel + Fast Polling Fallback + Optional Pusher)

export class RealtimeChannel {
  constructor(roomCode, onMessage) {
    this.roomCode = roomCode;
    this.onMessage = onMessage;
    this.bc = null;
    this.pollInterval = null;
    this.pusher = null;
    this.channel = null;

    if (typeof window === 'undefined') return;

    // 1. Setup BroadcastChannel for 0ms cross-tab sync
    if ('BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel(`hangman-room-${this.roomCode}`);
        this.bc.onmessage = (event) => {
          if (this.onMessage && event.data) {
            this.onMessage(event.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error', err);
      }
    }

    // 2. Setup fast state polling for cross-device / different-browser sync
    this.startPolling();

    // 3. Optional Pusher integration
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
    if (pusherKey) {
      import('pusher-js').then((module) => {
        const Pusher = module.default;
        this.pusher = new Pusher(pusherKey, { cluster: pusherCluster });
        this.channel = this.pusher.subscribe(`room-${this.roomCode}`);
        this.channel.bind('state_update', (data) => {
          if (this.onMessage) this.onMessage({ type: 'state_update', payload: data });
        });
      }).catch(() => {});
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (!this.roomCode) return;
      try {
        const res = await fetch(`/api/room/state?roomCode=${encodeURIComponent(this.roomCode)}`, {
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room && this.onMessage) {
            this.onMessage({ type: 'state_update', payload: data.room });
          }
        }
      } catch {
        // Ignore background polling network glitches
      }
    }, 750);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  broadcast(message) {
    // Broadcast instantly to local tabs
    if (this.bc) {
      try {
        this.bc.postMessage(message);
      } catch {}
    }
  }

  destroy() {
    this.stopPolling();
    if (this.bc) {
      try {
        this.bc.close();
      } catch {}
      this.bc = null;
    }
    if (this.channel && this.pusher) {
      try {
        this.pusher.unsubscribe(`room-${this.roomCode}`);
        this.pusher.disconnect();
      } catch {}
    }
  }
}
