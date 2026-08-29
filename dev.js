const { spawn } = require('child_process');

console.log('\x1b[36m%s\x1b[0m', '🚀 Starting Hangman Duel (Frontend + Socket.io Backend)...');

// 1. Start Socket.io Backend Server (Port 3001)
const backend = spawn('node', ['server.js'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3001' }
});

// 2. Start Next.js Frontend Dev Server (Port 3000)
const frontend = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000' }
});

const cleanup = () => {
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
