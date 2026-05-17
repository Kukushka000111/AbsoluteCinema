import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFetch,
  ensureGuestSession,
  loadGuestSession,
  type JoinRoomResponse,
  type LobbyListResponse,
  type RoomPublic,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { copyRoomLink, roomPath } from "../lib/links";
import { saveRoomSession } from "../lib/roomSession";

export default function LobbyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [privateId, setPrivateId] = useState("");
  const [rooms, setRooms] = useState<RoomPublic[]>([]);
  const [myRooms, setMyRooms] = useState<RoomPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const loadLobby = useCallback(
    async (q?: string, tags?: string) => {
      const params = new URLSearchParams();
      if (q?.trim()) params.set("q", q.trim());
      if (tags?.trim()) params.set("tags", tags.trim());
      const data = await apiFetch<LobbyListResponse>(`/lobby/rooms?${params}`);
      setRooms(data.items);
    },
    [],
  );

  const loadMyRooms = useCallback(async () => {
    if (!user) {
      setMyRooms([]);
      return;
    }
    const data = await apiFetch<RoomPublic[]>("/rooms/mine");
    setMyRooms(data);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLobby(), loadMyRooms()])
      .catch((e: Error) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [loadLobby, loadMyRooms, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadLobby(query, tagFilter).catch((e: Error) => toast(e.message, "error"));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query, tagFilter, loadLobby, toast]);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !createName.trim()) return;
    try {
      const tags = createTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const room = await apiFetch<RoomPublic>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          is_private: isPrivate,
          tags,
        }),
      });
      setCreateName("");
      setCreateTags("");
      toast(isPrivate ? "Приватная комната создана" : "Комната создана", "success");
      await loadMyRooms();
      if (!isPrivate) await loadLobby(query, tagFilter);
      if (isPrivate) {
        const ok = await copyRoomLink(room.id);
        if (ok) toast("Ссылка скопирована в буфер обмена", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось создать комнату", "error");
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      const guest = user ? null : loadGuestSession() ?? (await ensureGuestSession());
      const join = await apiFetch<JoinRoomResponse>(`/rooms/${roomId}/join`, {
        method: "POST",
        body: JSON.stringify(
          guest
            ? { guest_id: guest.guest_id, guest_display_name: guest.display_name }
            : {},
        ),
      });
      saveRoomSession(roomId, join);
      navigate(roomPath(roomId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  const joinPrivate = (e: FormEvent) => {
    e.preventDefault();
    const id = privateId.trim();
    if (!id) return;
    handleJoin(id);
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-fastwatch-panel to-fastwatch-bg p-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Смотрите видео <span className="text-fastwatch-accent">вместе</span>
        </h1>
        <p className="mt-2 max-w-xl text-fastwatch-muted">
          FastWatch — синхронный просмотр для друзей. Найдите комнату в лобби или войдите по прямой
          ссылке.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadLobby(query, tagFilter);
          }}
          className="mt-6 flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Умный поиск по названию..."
            className="flex-1 rounded-xl border border-white/10 bg-fastwatch-bg px-4 py-3 outline-none focus:border-fastwatch-accent"
          />
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Теги (через запятую)"
            className="w-full rounded-xl border border-white/10 bg-fastwatch-bg px-4 py-3 sm:w-48"
          />
        </form>
      </section>

      <section className="rounded-xl border border-dashed border-white/20 bg-fastwatch-panel/50 p-6">
        <h3 className="font-medium">Войти в приватную комнату</h3>
        <p className="mt-1 text-sm text-fastwatch-muted">Вставьте id из ссылки (после /room/)</p>
        <form onSubmit={joinPrivate} className="mt-3 flex gap-2">
          <input
            value={privateId}
            onChange={(e) => setPrivateId(e.target.value)}
            placeholder="например: a7k2m9xq"
            className="flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-fastwatch-accent px-4 py-2 text-sm font-medium text-white"
          >
            Войти
          </button>
        </form>
      </section>

      {user && (
        <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-6">
          <h3 className="text-lg font-medium">Создать комнату</h3>
          <p className="mt-1 text-sm text-fastwatch-muted">Вы станете админом с полным контролем плеера.</p>
          <form onSubmit={handleCreateRoom} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Название"
              className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-2 sm:col-span-2"
              required
            />
            <input
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="Теги: кино, музыка"
              className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-2"
            />
            <label className="flex items-center gap-2 self-center text-sm text-fastwatch-muted">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Приватная (скрыта из лобби)
            </label>
            <button
              type="submit"
              className="rounded-lg bg-fastwatch-accent py-2 font-medium text-white sm:col-span-2"
            >
              Создать
            </button>
          </form>
        </section>
      )}

      {user && myRooms.length > 0 && (
        <section>
          <h3 className="mb-4 text-lg font-medium">Мои комнаты</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myRooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} showHistoryLink showCopyLink />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-medium">Открытые комнаты</h3>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-white/10 bg-fastwatch-panel"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <p className="text-fastwatch-muted">Комнат не найдено. Создайте свою!</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} showCopyLink />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoomCard({
  room,
  onJoin,
  showHistoryLink,
  showCopyLink,
}: {
  room: RoomPublic;
  onJoin: (id: string) => void;
  showHistoryLink?: boolean;
  showCopyLink?: boolean;
}) {
  const { toast } = useToast();

  const copyLink = async () => {
    const ok = await copyRoomLink(room.id);
    toast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  };

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-fastwatch-panel p-4 transition hover:border-fastwatch-accent/40">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium leading-tight">{room.name}</h4>
        {room.is_private && (
          <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase">
            private
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-fastwatch-muted">
        {room.admin.username} · онлайн {room.online_count}
      </p>
      {room.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {room.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-fastwatch-accent/20 px-2 py-0.5 text-[10px] text-fastwatch-accent"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button
          type="button"
          onClick={() => onJoin(room.id)}
          className="rounded-lg bg-fastwatch-accent px-3 py-1.5 text-sm text-white hover:opacity-90"
        >
          Войти
        </button>
        {showCopyLink && (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Ссылка
          </button>
        )}
        {showHistoryLink && (
          <Link
            to={`/rooms/${room.id}/history`}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
            title="История просмотров"
          >
            ⊞
          </Link>
        )}
      </div>
    </article>
  );
}
