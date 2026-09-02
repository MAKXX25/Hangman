import { io } from 'socket.io-client';

let socket = null;

/**
 * Sanitizes and validates the backend URL to prevent mixed content blocks and trailing slashes.
 */
export function getBackendUrl() {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_SOCKET_URL;
  
  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, ''); // Strip all trailing slashes

    // Mixed Content Prevention:
    // If the frontend is served over HTTPS (or in production), ensure the backend URL uses https://
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isProduction = process.env.NODE_ENV === 'production';
    const isLocalhost = clean.includes('localhost') || clean.includes('127.0.0.1');

    if ((isHttpsPage || isProduction) && !isLocalhost && clean.startsWith('http://')) {
      console.warn('⚠️ [Mixed Content Auto-Upgrade] Upgraded backend URL from http:// to https:// to prevent browser security block.');
      clean = clean.replace(/^http:\/\//i, 'https://');
    }

    return clean;
  }

  // In local development / LAN, dynamically resolve the host machine's IP / hostname
  if (typeof window !== 'undefined' && window.location.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3001`;
  }

  // Fallback for SSR or non-browser execution
  return 'http://localhost:3001';
}

export function isBackendConfigured() {
  return getBackendUrl() !== null;
}

/**
 * Singleton Socket.io client with transport fallback (polling + websocket) and verbose lifecycle logging.
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
      // Allow fallback: start with polling handshake (bypasses restrictive firewalls) then upgrade to websocket
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000, // 20s connection timeout for free tier cold starts
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
      console.warn(`🔌 [Socket.io Disconnected] Reason: ${reason}`);
      if (reason === 'io server disconnect') {
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
