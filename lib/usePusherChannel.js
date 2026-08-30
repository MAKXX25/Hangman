// ─── usePusherChannel — React hook for Pusher Channels subscriptions ──────────
// Subscribes to a room channel, binds event handlers, and cleans up on unmount.
//
// Usage:
//   usePusherChannel(roomCode, {
//     state_update:      (data) => applyState(data),
//     game_start:        (data) => handleGameStart(data),
//     round_started:     ()     => forceResetRoundState(),
//     round_transitioning: ()   => forceResetRoundState(),
//     timer_tick:        (data) => { setTimerSecondsLeft(data.secondsLeft); ... },
//     timer_expired:     ()     => showToast('⏱ Time is up!'),
//     word_suggestions:  (data) => setSuggestions(data.suggestions),
//     word_validation:   (data) => handleWordValidation(data),
//     opponent_left:     ()     => handleOpponentLeft(),
//     error_msg:         (msg)  => showToast(msg),
//   });

import { useEffect, useRef } from 'react';
import { getPusherClient } from './pusherClient.js';

/**
 * Subscribes to the Pusher channel `room-${roomCode}` and binds all entries
 * in `handlers` to their respective event names.
 *
 * The hook re-subscribes automatically if `roomCode` changes, and cleans up
 * (unbinds + unsubscribes) when the component unmounts or roomCode changes.
 *
 * @param {string|null} roomCode   - Active room code, e.g. "ABC123". Pass null to skip.
 * @param {object}      handlers   - Map of { eventName: callbackFn }.
 */
export function usePusherChannel(roomCode, handlers) {
  // Keep handlers in a ref so we never need to re-subscribe when a handler
  // function identity changes (e.g. because the parent re-rendered).
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!roomCode) return;

    const pusher = getPusherClient();
    if (!pusher) return; // env var missing — graceful no-op

    const channelName = `room-${roomCode}`;
    const channel = pusher.subscribe(channelName);

    // Build stable wrapper callbacks so we can unbind them precisely later.
    const boundCallbacks = {};
    Object.keys(handlersRef.current).forEach((event) => {
      const stableCallback = (data) => {
        // Always read the latest handler ref so stale closures are never an issue.
        handlersRef.current[event]?.(data);
      };
      boundCallbacks[event] = stableCallback;
      channel.bind(event, stableCallback);
    });

    return () => {
      // Unbind all event callbacks and unsubscribe cleanly.
      Object.entries(boundCallbacks).forEach(([event, cb]) => {
        channel.unbind(event, cb);
      });
      pusher.unsubscribe(channelName);
    };
  }, [roomCode]); // Only re-run when roomCode changes
}
