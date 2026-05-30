import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { roomPath } from "../lib/links";

interface HistoryItem {
  id: string;
  video_url: string;
  title: string | null;
  started_at: string;
}

export default function RoomHistoryPage() {
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!roomId || authLoading) {return;}
    if (!user) {
      setError("Войдите в аккаунт, чтобы просмотреть историю комнаты");
      setFetching(false);
      return;
    }

    setFetching(true);
    apiFetch<HistoryItem[]>(`/rooms/${roomId}/history`)
      .then(setItems)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) {
          setError("История доступна только администратору комнаты");
        } else {
          setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
        }
      })
      .finally(() => setFetching(false));
  }, [authLoading, roomId, user]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/" className="text-sm text-fastwatch-accent hover:underline">
          ← Лобби
        </Link>
        {roomId && (
          <Link to={roomPath(roomId)} className="ml-4 text-sm text-fastwatch-accent hover:underline">
            К комнате
          </Link>
        )}
        <h1 className="mt-4 text-2xl font-bold">История просмотров</h1>
        {roomId && <p className="mt-1 text-sm text-fastwatch-muted">Комната {roomId}</p>}
      </div>

      {fetching ? (
        <p className="text-fastwatch-muted">Загрузка...</p>
      ) : error ? (
        <div className="rounded-xl border border-white/10 bg-fastwatch-panel p-6 text-center">
          <p className="text-fastwatch-muted">{error}</p>
          {!user && (
            <Link to="/login" className="mt-4 inline-block text-fastwatch-accent hover:underline">
              Войти
            </Link>
          )}
        </div>
      ) : items.length === 0 ? (
        <p className="text-fastwatch-muted">История пока пуста</p>
      ) : (
        <ul className="space-y-3">
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
      )}
    </div>
  );
}
