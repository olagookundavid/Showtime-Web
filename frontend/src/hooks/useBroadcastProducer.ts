import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';
import { calculateClockNow, type BroadcastState, type BroadcastPlayer, type GraphicEvent } from '../types';

export function getWebSocketURL(path: string): string {
  // Check if API_URL is absolute or relative
  let url = API_URL;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  const parsed = new URL(url);
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${parsed.host}${path}`;
}

/**
 * The hub batches queued updates into one WebSocket frame, newline-separated
 * (JSON from the server never contains a raw newline). Only the newest matters.
 */
export function parseLatestState(data: string): BroadcastState | null {
  const parts = data.split('\n').filter((part) => part.trim() !== '');
  return JSON.parse(parts[parts.length - 1]);
}

export function useBroadcastProducer(matchId: string) {
  const [state, setState] = useState<BroadcastState | null>(null);
  const [players, setPlayers] = useState<BroadcastPlayer[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<BroadcastState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const token = localStorage.getItem('showtime_access_token') || '';

  // Producer routes live under the admin group (gated by the broadcast_studio feature).
  const baseUrl = `${API_URL}/admin/matches/${matchId}/broadcast`;

  // Fetch initial state & players via REST, then connect the WebSocket
  useEffect(() => {
    if (!matchId) return;

    let isMounted = true;
    let reconnectDelay = 1000;

    async function fetchData() {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [stateRes, playersRes] = await Promise.all([
          axios.get(`${baseUrl}/state`, { headers }),
          axios.get(`${baseUrl}/players`, { headers }),
        ]);
        if (!isMounted) return;
        setState(stateRes.data);
        setPlayers(playersRes.data || []);
        setError(null);
      } catch (err) {
        console.error('[useBroadcastProducer] fetch error:', err);
        if (!isMounted) return;
        const message = axios.isAxiosError(err)
          ? err.response?.data?.error || err.message
          : 'Failed to load broadcast data';
        setError(message || 'Failed to load broadcast data');
      }
    }

    fetchData();

    function connectWS() {
      if (!isMounted) return;

      const wsPath = `${new URL(baseUrl, window.location.origin).pathname}/ws?token=${encodeURIComponent(token)}`;
      const wsUrl = getWebSocketURL(wsPath);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setError(null);
        reconnectDelay = 1000;
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const updatedState = parseLatestState(event.data);
          if (updatedState) setState(updatedState);
        } catch (e) {
          console.error('[useBroadcastProducer] WS parse error:', e);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        wsRef.current = null;
        // Exponential backoff reconnect (max 10s)
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
          connectWS();
        }, reconnectDelay);
      };

      ws.onerror = (err) => {
        console.warn('[useBroadcastProducer] WS error:', err);
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
  }, [matchId, token, baseUrl]);

  // Send state update through WS or fallback REST PUT
  const sendState = useCallback(async (newState: BroadcastState) => {
    setState(newState);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(newState));
    } else {
      // Fallback REST PUT
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.put(`${baseUrl}/state`, newState, { headers });
      } catch (err) {
        console.error('[useBroadcastProducer] REST sync error:', err);
      }
    }
  }, [baseUrl, token]);

  const updateField = useCallback(<K extends keyof BroadcastState>(key: K, value: BroadcastState[K]) => {
    if (!stateRef.current) return;
    const updated = {
      ...stateRef.current,
      [key]: value,
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  const updateScore = useCallback((manualHome: number, manualAway: number) => {
    if (!stateRef.current) return;
    const updated = {
      ...stateRef.current,
      manual_home: Math.max(0, manualHome),
      manual_away: Math.max(0, manualAway),
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  const toggleClock = useCallback(() => {
    if (!stateRef.current) return;
    const current = stateRef.current;
    const currentRemaining = calculateClockNow(current);
    const updated = {
      ...current,
      clock_seconds: currentRemaining,
      clock_running: !current.clock_running,
      clock_stamp: Date.now(),
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  const setClock = useCallback((seconds: number) => {
    if (!stateRef.current) return;
    const updated = {
      ...stateRef.current,
      clock_seconds: Math.max(0, seconds),
      clock_stamp: Date.now(),
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  const fireGraphic = useCallback((graphic: GraphicEvent) => {
    if (!stateRef.current) return;
    const updated = {
      ...stateRef.current,
      graphic,
      graphic_id: (stateRef.current.graphic_id || 0) + 1,
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  const hideGraphic = useCallback(() => {
    if (!stateRef.current) return;
    const updated = {
      ...stateRef.current,
      graphic: null,
      updated_at: Date.now(),
    };
    sendState(updated);
  }, [sendState]);

  return {
    state,
    players,
    isConnected,
    error,
    updateField,
    updateScore,
    toggleClock,
    setClock,
    fireGraphic,
    hideGraphic,
  };
}
