import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, type LobbyListResponse, type RoomPublic } from "../api/client";
import RoomCard from "../components/room/RoomCard";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { joinRoomById } from "../lib/joinRoom";
import { roomPath } from "../lib/links";

export default function OpenRoomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [rooms, setRooms] = useState<RoomPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRooms = useCallback(async (q = "") => {
    const params = new URLSearchParams();
    const trimmed = q.trim();
    if (trimmed.startsWith("#")) {
      params.set("tags", trimmed.slice(1).toLowerCase());
    } else if (trimmed) {
      params.set("q", trimmed);
    }
    const data = await apiFetch<LobbyListResponse>(`/lobby/rooms?${params}`);
    setRooms(data.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRooms(debouncedQuery)
      .catch((err: Error) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [debouncedQuery, loadRooms, toast]);

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
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Открытые комнаты</h1>
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-fastwatch-muted">
            Найти комнату
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название или #тег"
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
