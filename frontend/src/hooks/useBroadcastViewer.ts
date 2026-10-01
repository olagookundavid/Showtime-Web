import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../services/api';
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

    // Fetch initial state via public REST endpoint
    async function fetchInitialState() {
      try {
        // First try the root public endpoint
        let baseUrl = API_URL;
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `${window.location.origin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
        }
        const parsed = new URL(baseUrl);
        const origin = `${parsed.protocol}//${parsed.host}`;

        const res = await axios.get(`${origin}/broadcast/${matchId}/overlay/state`);
        if (isMounted && res.data) {
          setState(res.data);
        }
      } catch (err) {
        // Fallback to /api/v1 endpoint
        try {
          const res = await axios.get(`${API_URL}/matches/${matchId}/broadcast/state`);
          if (isMounted && res.data) {
            setState(res.data);
          }
        } catch (e) {
          // Will be populated when WebSocket connects
        }
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
