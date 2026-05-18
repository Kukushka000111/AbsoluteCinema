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
  const [showCreateForm, setShowCreateForm] = useState(false);

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
          name: "Новая комната",
          is_private: false,
          tags: [],
        }),
      });
      toast("Комната создана! Редактируйте в панели админа", "success");
      navigate(roomPath(room.id));
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
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fastwatch-panel to-fastwatch-bg border border-fastwatch-accent/20 p-12 sm:p-16">
        <div className="absolute inset-0 bg-gradient-hero opacity-60"></div>
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Смотрите видео <br />
            <span className="text-fastwatch-accent">вместе</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl max-w-2xl text-fastwatch-muted leading-relaxed">
            Создайте комнату, добавьте ссылку и смотрите синхронно с чатом.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              onClick={handleQuickCreate}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-fastwatch-accent hover:bg-fastwatch-accentDark text-white font-bold rounded-xl transition-colors"
            >
              <span>+</span> Создать комнату
            </button>
            {/* <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-fastwatch-accent/50 hover:border-fastwatch-accent text-fastwatch-accent font-semibold rounded-xl transition-colors"
            >
              ⚙️ Или с параметрами
            </button> */}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: "🔊", label: "Синхронно", desc: "Одновременный просмотр" },
          { icon: "💬", label: "Чат радом", desc: "Общайтесь в реальном времени" },
          { icon: "🔐", label: "Приватная ссылка", desc: "Только приглашённые" },
        ].map((feature, i) => (
          <div
            key={i}
            className="p-4 rounded-lg bg-fastwatch-panel border border-fastwatch-accent/20 text-center hover:border-fastwatch-accent/40 transition"
          >
            <div className="text-3xl mb-2">{feature.icon}</div>
            <h4 className="font-medium text-sm sm:text-base">{feature.label}</h4>
            <p className="text-xs text-fastwatch-muted mt-1">{feature.desc}</p>
          </div>
        ))}
      </section>

      {/* How to Start Section */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-bold mb-8">Как начать</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { num: 1, title: "Создайте комнату", desc: "Нажмите кнопку и получите ссылку" },
            { num: 2, title: "Добавьте видео", desc: "Вставьте ссылку или найдите в рольик" },
            { num: 3, title: "Пригласите друзей", desc: "Отправьте ссылку" },
          ].map((step) => (
            <div key={step.num} className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-fastwatch-accent text-white flex items-center justify-center font-bold text-lg">
                  {step.num}
                </div>
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-fastwatch-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Create Form Section */}
      {user && showCreateForm && (
        <section className="rounded-xl border border-fastwatch-accent/30 bg-fastwatch-panel p-8">
          <h3 className="text-xl font-bold mb-6">Создать новую комнату</h3>
          <form onSubmit={handleCreateRoom} className="grid gap-4 sm:grid-cols-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Название комнаты"
              className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 sm:col-span-2 focus:border-fastwatch-accent focus:outline-none"
              required
            />
            <input
              value={createTags}
              onChange={(e) => setCreateTags(e.target.value)}
              placeholder="Теги: кино, музыка"
              className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3"
            />
            <label className="flex items-center gap-2 text-sm text-fastwatch-muted py-3">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4"
              />
              Приватная (видна только вам и приглашённым)
            </label>
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-fastwatch-accent hover:bg-fastwatch-accentDark py-3 font-bold text-white transition"
              >
                Создать комнату
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition"
              >
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search and Join Section */}
      <section className="rounded-xl border border-white/10 bg-fastwatch-panel p-6 sm:p-8">
        <h3 className="text-lg font-bold mb-4">Найти комнату</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadLobby(query, tagFilter);
          }}
          className="flex flex-col gap-3"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию комнаты..."
            className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 focus:border-fastwatch-accent focus:outline-none transition"
          />
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Теги"
            className="rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 focus:border-fastwatch-accent focus:outline-none transition"
          />
        </form>
      </section>

      {/* Join Private Room */}
      <section className="rounded-xl border border-fastwatch-accent/20 bg-fastwatch-panel/50 p-6 sm:p-8">
        <h3 className="font-bold text-lg mb-2">Войти по ссылке</h3>
        <p className="text-sm text-fastwatch-muted mb-4">Вставьте ID комнаты</p>
        <form onSubmit={joinPrivate} className="flex gap-3 flex-col sm:flex-row">
          <input
            value={privateId}
            onChange={(e) => setPrivateId(e.target.value)}
            placeholder="Например: a7k2m9xq"
            className="flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-4 py-3 font-mono text-sm focus:border-fastwatch-accent focus:outline-none transition"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-fastwatch-accent hover:bg-fastwatch-accentDark text-white font-medium transition whitespace-nowrap"
          >
            Войти
          </button>
        </form>
      </section>

      {/* My Rooms Section */}
      {user && myRooms.length > 0 && (
        <section>
          <h3 className="mb-6 text-2xl font-bold">Мои комнаты</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myRooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} showHistoryLink showCopyLink />
            ))}
          </div>
        </section>
      )}

      {/* Open Rooms Section */}
      <section>
        <h3 className="mb-6 text-2xl font-bold">Открытые комнаты</h3>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-xl border border-white/10 bg-fastwatch-panel"
              />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-dashed border-white/10 bg-fastwatch-panel/30">
            <p className="text-lg text-fastwatch-muted">Комнат не найдено</p>
            <p className="text-sm text-fastwatch-muted/70 mt-2">Создайте свою комнату, чтобы начать</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={handleJoin} showCopyLink />
            ))}
          </div>
        )}
      </section>

      {/* Call to Action Section */}
      <section className="rounded-2xl border border-fastwatch-accent/30 bg-gradient-to-br from-fastwatch-accentDark/20 to-fastwatch-panel p-12 sm:p-16 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Готовы смотреть видео вместе?</h2>
        <p className="text-fastwatch-muted mb-8 max-w-2xl mx-auto text-lg">
          Создайте комнату за 5 секунд — без регистрации, без установки приложений, бесплатно
        </p>
        <button
          type="button"
          onClick={handleQuickCreate}
          className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-fastwatch-accent hover:bg-fastwatch-accentDark text-white font-bold text-lg rounded-xl transition-colors"
        >
          <span>+</span> Создать комнату
        </button>
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
    <article className="flex flex-col rounded-xl border border-white/10 bg-fastwatch-panel p-5 transition hover:border-fastwatch-accent/60 hover:bg-fastwatch-panel/80">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h4 className="font-semibold text-base leading-tight flex-1">{room.name}</h4>
        {room.is_private && (
          <span className="shrink-0 rounded-full bg-fastwatch-accent/20 px-2 py-1 text-[11px] font-medium text-fastwatch-accent">
            🔐
          </span>
        )}
      </div>
      <p className="text-xs text-fastwatch-muted mb-3">
        👤 {room.admin.username} · 🟢 {room.online_count}
      </p>
      {room.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {room.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-fastwatch-accent/20 px-2.5 py-1 text-[11px] text-fastwatch-accent font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={() => onJoin(room.id)}
          className="flex-1 rounded-lg bg-fastwatch-accent hover:bg-fastwatch-accentDark px-3 py-2 text-sm font-medium text-white transition"
        >
          Войти
        </button>
        {showCopyLink && (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 transition"
            title="Скопировать ссылку"
          >
            Ссылка
          </button>
        )}
        {showHistoryLink && (
          <Link
            to={`/rooms/${room.id}/history`}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 transition"
            title="История просмотров"
          >
            📋
          </Link>
        )}
      </div>
    </article>
  );
}
