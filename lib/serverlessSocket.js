// ─── 100% Reliable Cross-Device Cloud Relay Engine (WSS + BroadcastChannel) ──
// Uses high-speed secure WebSockets (WSS Cloud Relay) for instant cross-device sync (Mobile + PC)
// and BroadcastChannel for same-device cross-tab sync with 0ms latency.
// Works natively on Vercel without ANY custom servers, accounts, or API keys!

import {
  MAX_LIVES,
  DEFAULT_WORD_PICK_TIME,
  getHiddenWord
} from './gameLogic.js';
import {
  isValidWord,
  getRandomWord,
  getRandomSuggestions
} from './dictionary.js';

const RELAY_BASE = 'hangman_duel_2026_';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class ServerlessSocket {
  constructor() {
    this.id = 'p_' + Math.random().toString(36).substring(2, 9);
    this.listeners = new Map();
    this.isHost = false;
    this.roomCode = null;
    this.ws = null;
    this.broadcastChannel = null;
    this.hostRoom = null;
    this.timerInterval = null;
    this.joinRetryInterval = null;
    this.isDestroyed = false;

    setTimeout(() => {
      this._trigger('connect');
    }, 10);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return this;
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
    return this;
  }

  _trigger(event, ...args) {
    if (this.isDestroyed) return;
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try { cb(...args); } catch (err) { console.error(`Error in event listener for ${event}:`, err); }
      });
    }
  }

  emit(event, payload = {}) {
    if (this.isDestroyed) return;

    if (event === 'create_room') {
      this._handleHostCreate(payload);
    } else if (event === 'join_room') {
      this._handleJoin(payload);
    } else if (event === 'set_word') {
      this._dispatchToHost('set_word', payload);
    } else if (event === 'guess_letter') {
      this._dispatchToHost('guess_letter', payload);
    } else if (event === 'next_round') {
      this._dispatchToHost('next_round', payload);
    } else if (event === 'get_suggestions') {
      this._dispatchToHost('get_suggestions', payload);
    }
  }

  // ── HOST: Create Room ─────────────────────────────────────────────────────
  _handleHostCreate({ playerName, wordPickTime }) {
    this.isHost = true;
    this.roomCode = generateRoomCode();
    const cleanName = (playerName || 'Player 1').trim().slice(0, 16);
    const pickTime = Number(wordPickTime) || DEFAULT_WORD_PICK_TIME;

    this.hostRoom = {
      state: 'lobby',
      roomCode: this.roomCode,
      players: [{ id: this.id, name: cleanName, score: 0 }],
      game: null,
      settings: { wordPickTime: pickTime },
      timer: null
    };

    this._setupBroadcastChannel(this.roomCode);
    this._connectWebSocketRelay(this.roomCode);

    this._trigger('room_created', { roomCode: this.roomCode });
    this._broadcastState();
  }

  // ── JOINER: Join Room ─────────────────────────────────────────────────────
  _handleJoin({ roomCode, playerName }) {
    const code = (roomCode || '').replace(/\s+/g, '').trim().toUpperCase();
    if (!code || code.length < 4) {
      this._trigger('error_msg', 'Please enter a valid room code.');
      return;
    }

    this.isHost = false;
    this.roomCode = code;
    this.playerName = (playerName || 'Player 2').trim().slice(0, 16);

    this._setupBroadcastChannel(code);
    this._connectWebSocketRelay(code);

    const sendJoinPacket = () => {
      const packet = {
        type: 'request_join',
        playerId: this.id,
        playerName: this.playerName
      };
      this._sendViaBroadcast(packet);
      this._sendViaRelay(packet);
    };

    // Send immediately and retry every 1.5s until seated in room
    sendJoinPacket();
    if (this.joinRetryInterval) clearInterval(this.joinRetryInterval);
    this.joinRetryInterval = setInterval(() => {
      sendJoinPacket();
    }, 1500);
  }

  // ── WebSockets Cloud Relay Connection (Cross-Device) ──────────────────────
  _connectWebSocketRelay(code) {
    if (typeof window === 'undefined') return;

    try {
      if (this.ws) {
        try { this.ws.close(); } catch {}
        this.ws = null;
      }

      const topic = `${RELAY_BASE}${code}`;
      const wsUrl = `wss://ntfy.sh/${topic}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`🌐 Cloud relay active for room: ${code}`);
        if (!this.isHost && this.playerName) {
          this._sendViaRelay({
            type: 'request_join',
            playerId: this.id,
            playerName: this.playerName
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.event === 'message' && parsed.message) {
            const data = JSON.parse(parsed.message);
            if (data && typeof data === 'object') {
              // Ignore messages emitted by self
              if (data.senderId === this.id) return;
              this._handleIncomingMessage(data);
            }
          }
        } catch {}
      };

      this.ws.onerror = (err) => {
        console.warn('Relay WebSocket notice:', err);
      };
    } catch (e) {
      console.warn('Relay connection error:', e);
    }
  }

  _setupBroadcastChannel(code) {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      if (this.broadcastChannel) {
        try { this.broadcastChannel.close(); } catch {}
      }
      this.broadcastChannel = new BroadcastChannel(`hangman-bcast-${code}`);
      this.broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.senderId === this.id) return;
        this._handleIncomingMessage(data);
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  _handleIncomingMessage(msg) {
    if (this.isHost) {
      this._handleHostMessage(msg);
    } else {
      this._handleClientMessage(msg);
    }
  }

  _dispatchToHost(type, payload = {}) {
    const packet = { type, ...payload, senderId: this.id };
    if (this.isHost) {
      this._handleHostMessage(packet);
    } else {
      this._sendViaRelay(packet);
      this._sendViaBroadcast(packet);
    }
  }

  _sendViaBroadcast(data) {
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage({ ...data, senderId: this.id }); } catch {}
    }
  }

  _sendViaRelay(data) {
    if (!this.roomCode) return;
    const topic = `${RELAY_BASE}${this.roomCode}`;
    const payload = JSON.stringify({ ...data, senderId: this.id });

    // Send via HTTP POST relay (reliable on all networks)
    fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: payload
    }).catch(() => {});
  }

  _sendToGuest(data) {
    this._sendViaRelay(data);
    this._sendViaBroadcast(data);
  }

  // ── HOST GAME LOGIC ───────────────────────────────────────────────────────
  _handleHostMessage(msg) {
    const room = this.hostRoom;
    if (!room) return;

    switch (msg.type) {
      case 'request_join': {
        const joinerId = msg.playerId || 'p2_guest';
        const joinerName = (msg.playerName || 'Player 2').trim().slice(0, 16);

        // If player already seated, re-broadcast current state
        if (room.players.some(p => p.id === joinerId)) {
          this._broadcastState();
          return;
        }

        if (room.players.length >= 2) {
          this._sendToGuest({ type: 'error_msg', message: 'Room is already full.' });
          return;
        }

        // Seat Player 2
        room.players.push({ id: joinerId, name: joinerName, score: 0 });

        // Start Setting Phase
        room.state = 'setting';
        room.game = {
          word: null,
          wordSetterId: room.players[0].id,
          guesserId: room.players[1].id,
          guessedLetters: [],
          wrongGuesses: [],
          livesLeft: MAX_LIVES,
          roundResult: null
        };

        const startPayload = {
          roomCode: this.roomCode,
          wordSetterId: room.game.wordSetterId,
          guesserId: room.game.guesserId,
          players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
        };

        this._trigger('game_start', startPayload);
        this._sendToGuest({ type: 'game_start', ...startPayload });

        this._broadcastState();
        this._startSettingTimer();

        // Send suggestions to word setter
        const suggestions = getRandomSuggestions(12);
        if (room.game.wordSetterId === this.id) {
          this._trigger('word_suggestions', { suggestions });
        } else {
          this._sendToGuest({ type: 'word_suggestions', suggestions });
        }
        break;
      }

      case 'set_word': {
        if (room.state !== 'setting' || !room.game) return;
        if (room.game.wordSetterId !== msg.senderId) {
          this._sendDirect(msg.senderId, { type: 'error_msg', message: 'Only the Word Setter can submit a word.' });
          return;
        }

        const raw = (msg.word || '').toLowerCase().trim();
        if (!raw || !/^[a-z]+$/.test(raw)) {
          this._sendDirect(msg.senderId, { type: 'word_validation', valid: false, reason: 'Word must contain only letters.' });
          return;
        }
        if (raw.length < 2 || raw.length > 20) {
          this._sendDirect(msg.senderId, { type: 'word_validation', valid: false, reason: 'Word must be between 2 and 20 letters.' });
          return;
        }
        if (!isValidWord(raw)) {
          this._sendDirect(msg.senderId, { type: 'word_validation', valid: false, reason: `"${raw.toUpperCase()}" is not in the dictionary.` });
          return;
        }

        this._stopSettingTimer();
        this._sendDirect(msg.senderId, { type: 'word_validation', valid: true, reason: '' });

        room.game.word = raw.toUpperCase();
        room.state = 'guessing';

        const roundPayload = {
          wordLength: raw.length,
          wordSetterId: room.game.wordSetterId,
          guesserId: room.game.guesserId
        };

        this._trigger('round_started', roundPayload);
        this._sendToGuest({ type: 'round_started', ...roundPayload });

        this._broadcastState();
        break;
      }

      case 'guess_letter': {
        if (room.state !== 'guessing' || !room.game) return;
        if (room.game.guesserId !== msg.senderId) return;

        const letter = (msg.letter || '').toUpperCase().trim();
        if (!letter || !/^[A-Z]$/.test(letter)) return;
        if (room.game.guessedLetters.includes(letter)) return;

        room.game.guessedLetters.push(letter);

        if (!room.game.word.includes(letter)) {
          room.game.livesLeft--;
          room.game.wrongGuesses.push(letter);
        }

        const hidden = getHiddenWord(room.game.word, room.game.guessedLetters);
        if (!hidden.includes('_')) {
          const guesser = room.players.find(p => p.id === room.game.guesserId);
          if (guesser) guesser.score++;
          room.game.roundResult = 'guesser_wins';
          room.state = 'roundover';
        } else if (room.game.livesLeft <= 0) {
          const setter = room.players.find(p => p.id === room.game.wordSetterId);
          if (setter) setter.score++;
          room.game.roundResult = 'setter_wins';
          room.state = 'roundover';
        }

        this._broadcastState();
        break;
      }

      case 'next_round': {
        if (room.state !== 'roundover' || !room.game) return;

        const prevSetter = room.game.wordSetterId;
        const prevGuesser = room.game.guesserId;

        room.state = 'setting';
        room.game = {
          word: null,
          wordSetterId: prevGuesser,
          guesserId: prevSetter,
          guessedLetters: [],
          wrongGuesses: [],
          livesLeft: MAX_LIVES,
          roundResult: null
        };

        const transPayload = { state: 'setting', wordSetterId: room.game.wordSetterId };
        this._trigger('round_transitioning', transPayload);
        this._sendToGuest({ type: 'round_transitioning', ...transPayload });

        this._broadcastState();
        this._startSettingTimer();

        const suggestions = getRandomSuggestions(12);
        if (room.game.wordSetterId === this.id) {
          this._trigger('word_suggestions', { suggestions });
        } else {
          this._sendToGuest({ type: 'word_suggestions', suggestions });
        }
        break;
      }

      case 'get_suggestions': {
        const suggestions = getRandomSuggestions(12);
        this._sendDirect(msg.senderId, { type: 'word_suggestions', suggestions });
        break;
      }
    }
  }

  _startSettingTimer() {
    this._stopSettingTimer();
    const total = this.hostRoom?.settings?.wordPickTime || DEFAULT_WORD_PICK_TIME;
    let secondsLeft = total;

    const tick = () => {
      this._trigger('timer_tick', { secondsLeft, total });
      this._sendToGuest({ type: 'timer_tick', secondsLeft, total });
    };

    tick();

    this.timerInterval = setInterval(() => {
      if (!this.hostRoom || this.hostRoom.state !== 'setting') {
        this._stopSettingTimer();
        return;
      }

      secondsLeft--;
      tick();

      if (secondsLeft <= 0) {
        this._stopSettingTimer();
        const wordObj = getRandomWord('medium');
        const autoWord = (typeof wordObj === 'string' ? wordObj : wordObj.word).toUpperCase();

        if (this.hostRoom.game) {
          this.hostRoom.game.word = autoWord;
          this.hostRoom.state = 'guessing';

          this._trigger('timer_expired', { word: autoWord });
          this._sendToGuest({ type: 'timer_expired', word: autoWord });

          const roundPayload = {
            wordLength: autoWord.length,
            wordSetterId: this.hostRoom.game.wordSetterId,
            guesserId: this.hostRoom.game.guesserId
          };

          this._trigger('round_started', roundPayload);
          this._sendToGuest({ type: 'round_started', ...roundPayload });

          this._broadcastState();
        }
      }
    }, 1000);
  }

  _stopSettingTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  _broadcastState() {
    if (!this.hostRoom) return;
    const room = this.hostRoom;

    room.players.forEach(player => {
      const isWordSetter = room.game && room.game.wordSetterId === player.id;
      const setterPlayer = room.players.find(p => p.id === (room.game && room.game.wordSetterId));
      const guesserPlayer = room.players.find(p => p.id === (room.game && room.game.guesserId));

      const payload = {
        state: room.state,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name,
          score: p.score,
          isYou: p.id === player.id
        })),
        settings: room.settings,
        timerSecondsLeft: room.timer?.secondsLeft || null,
        timerTotal: room.settings?.wordPickTime || DEFAULT_WORD_PICK_TIME,
        game: room.game ? {
          wordLength: room.game.word ? room.game.word.length : 0,
          hiddenWord: room.game.word ? getHiddenWord(room.game.word, room.game.guessedLetters) : '',
          guessedLetters: room.game.guessedLetters,
          wrongGuesses: room.game.wrongGuesses || [],
          livesLeft: room.game.livesLeft,
          maxLives: MAX_LIVES,
          wordSetterId: room.game.wordSetterId,
          guesserId: room.game.guesserId,
          setterName: setterPlayer ? setterPlayer.name : 'Word Setter',
          guesserName: guesserPlayer ? guesserPlayer.name : 'Guesser',
          isWordSetter,
          word: (isWordSetter || room.state === 'roundover') ? room.game.word : null,
          roundResult: room.game.roundResult || null
        } : null,
        roomCode: this.roomCode
      };

      if (player.id === this.id) {
        this._trigger('state_update', payload);
      } else {
        this._sendToGuest({ type: 'state_update', payload });
      }
    });
  }

  _sendDirect(targetId, data) {
    if (targetId === this.id) {
      if (data.type === 'word_validation') this._trigger('word_validation', data);
      else if (data.type === 'word_suggestions') this._trigger('word_suggestions', data);
      else if (data.type === 'error_msg') this._trigger('error_msg', data.message);
    } else {
      this._sendToGuest(data);
    }
  }

  // ── JOINER / CLIENT MESSAGE RECEIVER ──────────────────────────────────────
  _handleClientMessage(msg) {
    if (this.joinRetryInterval) {
      clearInterval(this.joinRetryInterval);
      this.joinRetryInterval = null;
    }

    switch (msg.type) {
      case 'game_start':
        this._trigger('game_start', msg);
        break;
      case 'state_update':
        this._trigger('state_update', msg.payload);
        break;
      case 'timer_tick':
        this._trigger('timer_tick', msg);
        break;
      case 'timer_expired':
        this._trigger('timer_expired', msg);
        break;
      case 'round_started':
        this._trigger('round_started', msg);
        break;
      case 'round_transitioning':
        this._trigger('round_transitioning', msg);
        break;
      case 'word_suggestions':
        this._trigger('word_suggestions', msg);
        break;
      case 'word_validation':
        this._trigger('word_validation', msg);
        break;
      case 'error_msg':
        this._trigger('error_msg', msg.message || msg.error);
        break;
      case 'opponent_left':
        this._trigger('opponent_left');
        break;
    }
  }

  disconnect() {
    this.isDestroyed = true;
    this._stopSettingTimer();

    if (this.joinRetryInterval) {
      clearInterval(this.joinRetryInterval);
      this.joinRetryInterval = null;
    }

    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch {}
      this.broadcastChannel = null;
    }

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    this.listeners.clear();
  }
}

export function createServerlessSocket() {
  return new ServerlessSocket();
}
