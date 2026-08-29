// In-memory rooms cache for Next.js API Routes (with global persistence during dev/serverless invocation)
globalThis.__hangmanRooms = globalThis.__hangmanRooms || new Map();
const rooms = globalThis.__hangmanRooms;

export function getRoom(code) {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) || null;
}

export function saveRoom(code, roomData) {
  if (!code) return;
  rooms.set(code.toUpperCase(), roomData);
}

export function deleteRoom(code) {
  if (!code) return;
  rooms.delete(code.toUpperCase());
}

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
