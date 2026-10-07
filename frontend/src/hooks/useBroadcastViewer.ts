import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import type { BroadcastState } from '../types/broadcast';
import { getWebSocketURL } from './useBroadcastProducer';

export function useBroadcastViewer(matchId: string) {
  const [state, setState] = useState<BroadcastState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!matchId) return;

    let isMounted = true;
    let reconnectDelay = 1000;

    // Fetch initial state via the public overlay endpoint (served from the API host root)
    async function fetchInitialState() {
      try {
        const origin = new URL(API_URL, window.location.origin).origin;
        const res = await axios.get(`${origin}/broadcast/${matchId}/overlay/state`);
        if (isMounted && res.data) {
          setState(res.data);
        }
      } catch {
        // Will be populated when WebSocket connects
      }
    }

    fetchInitialState();

    function connectWS() {
      if (!isMounted) return;

      const wsPath = `/broadcast/${matchId}/overlay/ws`;
      const wsUrl = getWebSocketURL(wsPath);

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
          const updatedState = JSON.parse(event.data);
          setState(updatedState);
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
  }, [matchId]);

  return { state, isConnected };
}
