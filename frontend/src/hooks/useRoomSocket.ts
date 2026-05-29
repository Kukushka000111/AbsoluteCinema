import { useCallback, useEffect, useRef, useState } from "react";

export type WsMessage = {
  type: string;
  payload?: Record<string, unknown>;
  sender_id?: string | null;
};

type Handler = (msg: WsMessage) => void;

export function useRoomSocket(
  roomId: string | undefined,
  wsToken: string | undefined,
  onMessage: Handler,
) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(wsToken)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        handlerRef.current(data);
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId, wsToken]);

  return { connected, send };
}
