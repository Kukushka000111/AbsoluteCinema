import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, type RoomPublic } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { joinRoomById } from "../lib/joinRoom";
import { copyRoomLink, roomPath } from "../lib/links";

export default function LobbyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [myRooms, setMyRooms] = useState<RoomPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [createTags, setCreateTags] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

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
    loadMyRooms()
      .catch((e: Error) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [loadMyRooms, toast]);

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const tags = createTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const room = await apiFetch<RoomPublic>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: null,
          is_private: isPrivate,
          tags,
        }),
      });
      setCreateTags("");
      setIsPrivate(false);
      setShowCreateForm(false);
      toast(isPrivate ? "Приватная комната создана" : "Комната создана", "success");
      navigate(roomPath(room.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось создать комнату", "error");
    }
  };

  const handleQuickCreate = async () => {
    if (!user) {
      navigate("/register");
      return;
    }
    try {
      const room = await apiFetch<RoomPublic>("/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: null,
          is_private: false,
          tags: [],
        }),
      });
      toast("Комната создана", "success");
      navigate(roomPath(room.id));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось создать комнату", "error");
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      await joinRoomById(roomId, Boolean(user));
      navigate(roomPath(roomId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось войти в комнату", "error");
    }
  };

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-fastwatch-accent/20 bg-gradient-to-br from-fastwatch-panel to-fastwatch-bg p-10 sm:p-14">
        <div className="absolute inset-0 bg-gradient-hero opacity-60" />
        <div className="relative z-10 max-w-3xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Смотрите видео вместе
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fastwatch-muted sm:text-xl">
            Создайте комнату, добавьте ссылку и смотрите синхронно с чатом.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleQuickCreate}
              className="inline-flex items-center justify-center rounded-xl bg-fastwatch-accent px-8 py-3 font-bold text-white transition hover:bg-fastwatch-accentDark"
            >
              Создать комнату
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setShowCreateForm((value) => !value)}
                className="inline-flex items-center justify-center rounded-xl border border-fastwatch-accent/50 px-8 py-3 font-semibold text-fastwatch-accent transition hover:border-fastwatch-accent"
              >
                Параметры
              </button>
            )}
            <Link
              to="/rooms"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-8 py-3 font-semibold text-fastwatch-muted transition hover:bg-white/5 hover:text-white"
            >
              Открытые комнаты
            </Link>
          </div>
        </div>
      </section>

      {user && showCreateForm && (
        <section className="rounded-xl border border-fastwatch-accent/30 bg-fastwatch-panel p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-bold">Создать новую комнату</h2>
          <form onSubmit={handleCreateRoom} className="grid gap-4 sm:grid-cols-2">
            <input
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="Теги: кино, музыка"
              className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 focus:border-fastwatch-accent focus:outline-none"
            />
            <label className="flex items-center gap-2 py-3 text-sm text-fastwatch-muted">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4"
              />
              Приватная комната
            </label>
            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-fastwatch-accent py-3 font-bold text-white transition hover:bg-fastwatch-accentDark"
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-white/10 px-6 py-3 transition hover:bg-white/5"
              >
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {user && (
        <section>
          <h2 className="mb-6 text-2xl font-bold">Мои комнаты</h2>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 animate-pulse rounded-xl border border-white/10 bg-fastwatch-panel"
                />
              ))}
            </div>
          ) : myRooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-fastwatch-panel/30 py-10 text-center">
              <p className="text-fastwatch-muted">У вас пока нет комнат</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myRooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={handleJoin} showHistoryLink />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function RoomCard({
  room,
  onJoin,
  showHistoryLink,
}: {
  room: RoomPublic;
  onJoin: (id: string) => void;
  showHistoryLink?: boolean;
}) {
  const { toast } = useToast();

  const copyLink = async () => {
    const ok = await copyRoomLink(room.id);
    toast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  };

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-fastwatch-panel p-5 transition hover:border-fastwatch-accent/60 hover:bg-fastwatch-panel/80">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{room.name}</h3>
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
      <div className="mt-auto flex flex-wrap gap-2 border-t border-white/5 pt-4">
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
        {showHistoryLink && (
          <Link
            to={`/rooms/${room.id}/history`}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
          >
            История
          </Link>
        )}
      </div>
    </article>
  );
}
