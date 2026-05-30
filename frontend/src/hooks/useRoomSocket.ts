import { useCallback, useEffect, useRef, useState } from "react";

export type WsMessage = {
  type: string;
  payload?: Record<string, unknown>;
  sender_id?: string | null;
};

type Handler = (msg: WsMessage) => void;

const MAX_RECONNECT_DELAY_MS = 10_000;

export function useRoomSocket(
  roomId: string | undefined,
  wsToken: string | undefined,
  onMessage: Handler,
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  handlerRef.current = onMessage;

  const send = useCallback((type: string, payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify({ type, payload }));
    return true;
  }, []);

  useEffect(() => {
    if (!roomId || !wsToken) {return;}

    let cancelled = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled) {return;}

      clearReconnectTimer();
      wsRef.current?.close();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(wsToken)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) {return;}
        const delay = Math.min(
          1000 * 2 ** reconnectAttemptRef.current,
          MAX_RECONNECT_DELAY_MS,
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsMessage;
          handlerRef.current(data);
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [roomId, wsToken]);

  return { connected, send };
}
