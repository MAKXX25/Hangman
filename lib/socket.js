import { io } from 'socket.io-client';

let socket = null;

/**
 * Validates whether the backend URL is properly configured.
 */
export function getBackendUrl() {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
  
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }

  // In local development, fallback to localhost:3001
  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:3001';
  }

  // In production, return null if not configured
  return null;
}

export function isBackendConfigured() {
  return getBackendUrl() !== null;
}

/**
 * Singleton Socket.io client with verbose lifecycle logging and transport resilience.
 */
export function getSocket() {
  if (typeof window === 'undefined') return null;

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    console.error(
      '❌ [Socket.io Config Error]: NEXT_PUBLIC_BACKEND_URL is not defined in your Vercel Environment Variables.'
    );
    return null;
  }

  if (!socket) {
    console.log("Attempting to connect to:", process.env.NEXT_PUBLIC_BACKEND_URL);
    console.log("Resolved Socket.io Backend URL:", backendUrl);

    socket = io(backendUrl, {
      transports: ['websocket', 'polling'], // Start with WebSocket, fallback to polling
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // 20s connection timeout for cold starts
    });

    // ── Verbose Lifecycle & Error Logging ─────────────────────────────────
    socket.on('connect', () => {
      console.log(`✅ [Socket.io Connected] Socket ID: ${socket.id} via transport: ${socket.io.engine.transport.name}`);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ [Socket.io Connect Error]:', {
        message: err.message,
        description: err.description,
        context: err.context,
        targetUrl: backendUrl,
        activeTransport: socket.io.engine?.transport?.name || 'unknown',
      });
    });

    socket.on('disconnect', (reason) => {
      console.warn(`⚠️ [Socket.io Disconnected] Reason: ${reason}`);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        socket.connect();
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 [Socket.io Reconnect Attempt #${attempt}] Trying ${backendUrl}...`);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ [Socket.io Reconnection Failed] Check backend server status & CORS settings.');
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
