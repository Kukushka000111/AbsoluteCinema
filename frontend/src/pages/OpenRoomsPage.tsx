import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, type LobbyListResponse, type RoomPublic } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { joinRoomById } from "../lib/joinRoom";
import { copyRoomLink, roomPath } from "../lib/links";

export default function OpenRoomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<RoomPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async (q = "") => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const data = await apiFetch<LobbyListResponse>(`/lobby/rooms?${params}`);
    setRooms(data.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRooms(query)
      .catch((err: Error) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [loadRooms, query, toast]);

  const handleJoin = async (roomId: string) => {
    try {
      await joinRoomById(roomId, Boolean(user));
      navigate(roomPath(roomId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <Link to="/" className="text-sm text-fastwatch-accent hover:underline">
          Назад в лобби
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Открытые комнаты</h1>
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-fastwatch-muted">
            Найти комнату
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название или тег"
            className="w-full rounded-lg border border-white/10 bg-fastwatch-panel px-4 py-3 focus:border-fastwatch-accent focus:outline-none"
          />
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-40 animate-pulse rounded-xl border border-white/10 bg-fastwatch-panel"
            />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-fastwatch-panel/30 py-12 text-center">
          <p className="text-lg text-fastwatch-muted">Комнаты не найдены</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={handleJoin} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onJoin }: { room: RoomPublic; onJoin: (id: string) => void }) {
  const { toast } = useToast();

  const copyLink = async () => {
    const ok = await copyRoomLink(room.id);
    toast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  };

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-fastwatch-panel p-5 transition hover:border-fastwatch-accent/60 hover:bg-fastwatch-panel/80">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{room.name}</h2>
        {room.is_private && (
          <span className="shrink-0 rounded-full bg-fastwatch-accent/20 px-2 py-1 text-[11px] font-medium text-fastwatch-accent">
            Закрытая
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-fastwatch-muted">
        {room.admin.username} · онлайн: {room.online_count}
      </p>
      {room.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {room.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-fastwatch-accent/20 px-2.5 py-1 text-[11px] font-medium text-fastwatch-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex gap-2 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => onJoin(room.id)}
          className="flex-1 rounded-lg bg-fastwatch-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-fastwatch-accentDark"
        >
          Войти
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
        >
          Ссылка
        </button>
      </div>
    </article>
  );
}
