import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    // Dynamic backend URL: checks NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_BACKEND_URL, or defaults to local server
    const backendUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:3001';

    socket = io(backendUrl, {
      transports: ['websocket', 'polling'], // Start with WebSocket, fallback to polling if blocked
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000, // 10s connection timeout
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Standalone Socket.io Backend:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket Connection Error (Server might be waking up):', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from Socket.io Backend:', reason);
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
