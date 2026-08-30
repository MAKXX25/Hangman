// ─── Cross-Device Serverless Realtime Engine (MQTT P2P + BroadcastChannel) ──
// Uses @trystero-p2p/mqtt for global cross-device synchronization (iPhone, Android, PC, Mac)
// and BroadcastChannel for same-device cross-tab testing with 0ms latency.
// Works 100% on Vercel with ZERO backend servers, ZERO API keys, and ZERO config!

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
    this.trysteroRoom = null;
    this.sendAction = null;
    this.broadcastChannel = null;
    this.hostRoom = null;
    this.timerInterval = null;
    this.isDestroyed = false;
    this.connectedPeers = new Set();

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
  async _handleHostCreate({ playerName, wordPickTime }) {
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
    await this._initTrysteroRoom(this.roomCode);

    this._trigger('room_created', { roomCode: this.roomCode });
    this._broadcastState();
  }

  // ── JOINER: Join Room ─────────────────────────────────────────────────────
  async _handleJoin({ roomCode, playerName }) {
    const code = (roomCode || '').toUpperCase().trim();
    if (!code || code.length < 4) {
      this._trigger('error_msg', 'Please enter a valid room code.');
      return;
    }

    this.isHost = false;
    this.roomCode = code;
    this.playerName = (playerName || 'Player 2').trim().slice(0, 16);

    this._setupBroadcastChannel(code);
    await this._initTrysteroRoom(code);

    // Announce join request via BroadcastChannel (local tabs)
    this._sendViaBroadcast({
      type: 'request_join',
      playerId: this.id,
      playerName: this.playerName
    });

    // Announce join request via MQTT P2P (cross-device)
    if (this.sendAction) {
      this.sendAction({
        type: 'request_join',
        playerId: this.id,
        playerName: this.playerName
      });
    }
  }

  // ── Initialize Cross-Device P2P Network (Trystero MQTT) ───────────────────
  async _initTrysteroRoom(code) {
    if (typeof window === 'undefined') return;

    try {
      const { joinRoom } = await import('@trystero-p2p/mqtt');
      
      const config = {
        appId: 'hangman-duel-2026'
      };

      this.trysteroRoom = joinRoom(config, `ROOM_${code}`);
      const [sendAction, getAction] = this.trysteroRoom.makeAction('game_action');
      this.sendAction = sendAction;

      this.trysteroRoom.onPeerJoin((peerId) => {
        console.log(`📡 Peer joined room: ${peerId}`);
        this.connectedPeers.add(peerId);

        if (this.isHost) {
          // Send current state to newly joined peer
          this._broadcastState();
        } else {
          // Guest sends join handshake as soon as peer connection is ready
          this.sendAction({
            type: 'request_join',
            playerId: this.id,
            playerName: this.playerName || 'Player 2'
          }, peerId);
        }
      });

      this.trysteroRoom.onPeerLeave((peerId) => {
        console.log(`🔌 Peer left room: ${peerId}`);
        this.connectedPeers.delete(peerId);
        if (this.isHost) {
          this._handleGuestLeft();
        } else {
          this._trigger('opponent_left');
        }
      });

      getAction((data, peerId) => {
        if (!data || typeof data !== 'object') return;
        this._handleIncomingMessage(data, peerId);
      });

      console.log(`🌐 Cross-device network active for room: ${code}`);
    } catch (err) {
      console.warn('Trystero network initialization error:', err);
    }
  }

  _setupBroadcastChannel(code) {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel(`hangman-bcast-${code}`);
      this.broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        this._handleIncomingMessage(data, 'broadcast');
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // ── Unified Message Router ────────────────────────────────────────────────
  _handleIncomingMessage(msg, peerId) {
    if (this.isHost) {
      this._handleHostMessage(msg, peerId);
    } else {
      this._handleClientMessage(msg);
    }
  }

  _dispatchToHost(type, payload = {}) {
    const packet = { type, ...payload, senderId: this.id };
    if (this.isHost) {
      this._handleHostMessage(packet, this.id);
    } else {
      if (this.sendAction) {
        try { this.sendAction(packet); } catch {}
      }
      this._sendViaBroadcast(packet);
    }
  }

  _sendViaBroadcast(data) {
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(data); } catch {}
    }
  }

  _sendToGuest(data) {
    if (this.sendAction) {
      try { this.sendAction(data); } catch {}
    }
    this._sendViaBroadcast(data);
  }

  // ── HOST GAME LOGIC ───────────────────────────────────────────────────────
  _handleHostMessage(msg, peerId) {
    const room = this.hostRoom;
    if (!room) return;

    switch (msg.type) {
      case 'request_join': {
        const joinerId = msg.playerId || peerId || 'guest_p2';
        const joinerName = (msg.playerName || 'Player 2').trim().slice(0, 16);

        // Already joined
        if (room.players.some(p => p.id === joinerId)) {
          this._broadcastState();
          return;
        }

        if (room.players.length >= 2) {
          this._sendToGuest({ type: 'error_msg', message: 'Room is already full.' });
          return;
        }

        // Add guest player
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

  _handleGuestLeft() {
    if (!this.hostRoom) return;
    this._stopSettingTimer();
    this.hostRoom.players = this.hostRoom.players.filter(p => p.id === this.id);
    this.hostRoom.state = 'lobby';
    this.hostRoom.game = null;
    this._trigger('opponent_left');
    this._broadcastState();
  }

  _startSettingTimer() {
    this._stopSettingTimer();
    const total = this.hostRoom.settings?.wordPickTime || DEFAULT_WORD_PICK_TIME;
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

    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch {}
      this.broadcastChannel = null;
    }

    if (this.trysteroRoom) {
      try { this.trysteroRoom.leave(); } catch {}
      this.trysteroRoom = null;
    }

    this.listeners.clear();
  }
}

export function createServerlessSocket() {
  return new ServerlessSocket();
}
