import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { overlayPath, type BroadcastState, type OverlayTarget } from '../types';
import { getWebSocketURL, parseLatestState } from './useBroadcastProducer';

/**
 * Follows an overlay target: one match, or an event day (whichever match is on
 * air). state is null until loaded, and for a day with nothing on air.
 */
export function useBroadcastViewer(target: OverlayTarget) {
  const path = overlayPath(target);
  const hasTarget = target.kind === 'match' ? !!target.matchId : !!target.date;
  const [state, setState] = useState<BroadcastState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasTarget) return;

    let isMounted = true;
    let reconnectDelay = 1000;

    // Fetch initial state via the public overlay endpoint (served from the API host root)
    async function fetchInitialState() {
      try {
        const origin = new URL(API_URL, window.location.origin).origin;
        const res = await axios.get(`${origin}${path}/state`);
        if (isMounted) {
          setState(res.data || null);
        }
      } catch {
        // Will be populated when WebSocket connects
      }
    }

    fetchInitialState();

    function connectWS() {
      if (!isMounted) return;

      const wsUrl = getWebSocketURL(`${path}/ws`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        reconnectDelay = 1000;
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          // null means the event day has nothing on air: show a blank overlay.
          setState(parseLatestState(event.data));
        } catch (e) {
          console.error('[useBroadcastViewer] WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
          connectWS();
        }, reconnectDelay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWS();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [path, hasTarget]);

  return { state, isConnected };
}
