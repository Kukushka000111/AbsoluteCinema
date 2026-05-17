import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";

interface HistoryItem {
  id: string;
  video_url: string;
  title: string | null;
  started_at: string;
}

export default function RoomHistoryPage() {
  const { roomId } = useParams();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    apiFetch<HistoryItem[]>(`/rooms/${roomId}/history`)
      .then(setItems)
      .catch((e: Error) => setError(e.message));
  }, [roomId]);

  return (
    <div>
      <Link to="/" className="text-sm text-fastwatch-accent hover:underline">
        ← Лобби
      </Link>
      <h2 className="mt-4 text-2xl font-semibold">История комнаты {roomId}</h2>
      {error && <p className="mt-4 text-red-400">{error}</p>}
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-white/10 bg-fastwatch-panel p-4 text-sm"
          >
            <p className="font-medium">{item.title ?? "Без названия"}</p>
            <p className="mt-1 break-all text-fastwatch-muted">{item.video_url}</p>
            <p className="mt-1 text-xs text-fastwatch-muted">
              {new Date(item.started_at).toLocaleString("ru-RU")}
            </p>
          </li>
        ))}
      </ul>
      {!error && items.length === 0 && (
        <p className="mt-6 text-fastwatch-muted">История пока пуста</p>
      )}
    </div>
  );
}
