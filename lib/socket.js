import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (typeof window === 'undefined') return null;

  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    socket = io(backendUrl, {
      transports: ['websocket'],
      upgrade: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Standalone WebSocket Backend:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket Connection Error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from WebSocket Backend:', reason);
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
