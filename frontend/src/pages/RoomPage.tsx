import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ensureGuestSession, loadGuestSession, type JoinRoomResponse, type RoomPublic } from "../api/client";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import RoomSidebar, { type RoomSidebarTab } from "../components/room/RoomSidebar";
import SyncPlayer from "../components/room/SyncPlayer";
import { useRoomSocket, type WsMessage } from "../hooks/useRoomSocket";
import {
  loadRoomMeta,
  loadRoomSession,
  removeRoomSession,
  saveRoomMeta,
  saveRoomSession,
  updateRoomSessionPlayer,
} from "../lib/roomSession";
import type { ChatMessage, Participant, PlayerState, QueueItem } from "../types/room";
import { getEffectiveTime, parseChatHistory } from "../types/room";
import { useToast } from "../context/ToastContext";
import { copyRoomLink } from "../lib/links";

const MOBILE_TABS: { id: RoomSidebarTab; label: string; icon: string }[] = [
  { id: "chat", label: "Чат", icon: "💬" },
  { id: "queue", label: "Очередь", icon: "📋" },
  { id: "users", label: "Люди", icon: "👥" },
];

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState(() => (roomId ? loadRoomSession(roomId) : null));
  const [playerState, setPlayerState] = useState<PlayerState | null>(session?.playerState ?? null);
  const [queues, setQueues] = useState<{ main: QueueItem[]; sugg: QueueItem[] }>({ main: [], sugg: [] });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [roomName, setRoomName] = useState(() => (roomId ? loadRoomMeta(roomId)?.name ?? "" : ""));
  const [roomTags, setRoomTags] = useState<string[]>(() => (roomId ? loadRoomMeta(roomId)?.tags ?? [] : []));
  const [roomIsPrivate, setRoomIsPrivate] = useState(() => (roomId ? loadRoomMeta(roomId)?.isPrivate ?? false : false));
  const [loading, setLoading] = useState(!session);
  const [mobilePanel, setMobilePanel] = useState<RoomSidebarTab | null>(null);
  const [deleteRoomLoading, setDeleteRoomLoading] = useState(false);

  const applyRoomMeta = useCallback(
    (meta: { name: string; tags: string[]; isPrivate: boolean }) => {
      setRoomName(meta.name);
      setRoomTags(meta.tags);
      setRoomIsPrivate(meta.isPrivate);
      if (roomId) {
        saveRoomMeta(roomId, meta);
      }
    },
    [roomId],
  );

  const loadRoomMetaFromApi = useCallback(async () => {
    if (!roomId) {return;}
    try {
      const room = await apiFetch<RoomPublic>(`/rooms/${roomId}`);
      applyRoomMeta({
        name: room.name,
        tags: room.tags ?? [],
        isPrivate: room.is_private,
      });
    } catch {
      /* keep cached meta if fetch fails */
    }
  }, [applyRoomMeta, roomId]);

  const ensureJoin = useCallback(async () => {
    if (!roomId) {return;}
    const guest = user ? null : loadGuestSession() ?? (await ensureGuestSession());
    const join = await apiFetch<JoinRoomResponse>(`/rooms/${roomId}/join`, {
      method: "POST",
      body: JSON.stringify(
        guest
          ? { guest_id: guest.guest_id, guest_display_name: guest.display_name }
          : {},
      ),
    });
    const s = saveRoomSession(roomId, join);
    setSession(s);
    setPlayerState(join.player_state);
    applyRoomMeta({
      name: join.room.name,
      tags: join.room.tags ?? [],
      isPrivate: join.room.is_private,
    });
    setLoading(false);
  }, [applyRoomMeta, roomId, user]);

  useEffect(() => {
    if (!roomId) {return;}
    void loadRoomMetaFromApi();
  }, [loadRoomMetaFromApi, roomId]);

  useEffect(() => {
    if (!roomId) {return;}
    if (session?.joined) {
      setLoading(false);
      return;
    }
    ensureJoin().catch((err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось войти в комнату";
      toast(message, "error");
      navigate("/");
    });
  }, [roomId, session?.joined, ensureJoin, navigate, toast]);

  const handleSessionExpired = useCallback(() => {
    if (!roomId) {return;}
    removeRoomSession(roomId);
    setSession(null);
    setPlayerState(null);
    setChat([]);
    setLoading(true);
    ensureJoin().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Не удалось переподключиться";
      toast(message, "error");
      navigate("/");
    });
  }, [ensureJoin, navigate, roomId, toast]);

  useEffect(() => {
    if (authLoading || !roomId || !session || !session.isGuest || !user) {return;}
    removeRoomSession(roomId);
    setSession(null);
    setPlayerState(null);
    setChat([]);
    setLoading(true);
    ensureJoin().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Не удалось переподключиться";
      toast(message, "error");
      navigate("/");
    });
  }, [authLoading, ensureJoin, navigate, roomId, session, toast, user]);

  useEffect(() => {
    if (authLoading || !roomId || !session || session.isGuest || user) {return;}
    removeRoomSession(roomId);
    setSession(null);
    setPlayerState(null);
    setChat([]);
    setLoading(true);
    ensureJoin().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Не удалось переподключиться";
      toast(message, "error");
      navigate("/");
    });
  }, [authLoading, ensureJoin, navigate, roomId, session, toast, user]);

  useEffect(() => {
    if (!mobilePanel) {return;}
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobilePanel]);

  const handleWs = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "KICKED" || msg.type === "BANNED") {
        toast(
          msg.type === "BANNED" ? "Вы забанены в этой комнате" : "Вас исключили из комнаты",
          "error",
        );
        if (roomId) {removeRoomSession(roomId);}
        navigate("/");
        return;
      }
      if (msg.type === "ROOM_CLOSED") {
        const reason = (msg.payload as { reason?: string } | undefined)?.reason;
        toast(
          reason === "inactive"
            ? "Комната закрыта из-за неактивности (1 час без входов)"
            : "Комната закрыта",
          "error",
        );
        if (roomId) {removeRoomSession(roomId);}
        navigate("/");
        return;
      }
      if (msg.type === "GLOBALLY_BANNED") {
        toast("Ваш аккаунт заблокирован на сайте", "error");
        if (roomId) {removeRoomSession(roomId);}
        navigate("/");
        return;
      }
      if (msg.type === "ERROR") {
        const detail = (msg.payload as { detail?: string })?.detail;
        if (detail) {toast(detail, "error");}
        return;
      }
      if (msg.type === "CONNECTED") {
        const p = msg.payload as {
          player_state: PlayerState;
          queues: { main: QueueItem[]; sugg: QueueItem[] };
          participants: Participant[];
          chat_history?: unknown[];
        };
        setPlayerState(p.player_state);
        setQueues(p.queues);
        setParticipants(p.participants);
        if (Array.isArray(p.chat_history) && p.chat_history.length > 0) {
          setChat(parseChatHistory(p.chat_history));
        }
        if (roomId) {updateRoomSessionPlayer(roomId, p.player_state);}
        return;
      }
      if (msg.type === "PLAYER_STATE") {
        const p = msg.payload as unknown as PlayerState & { action?: string };
        const next: PlayerState = {
          video_url: p.video_url ?? "",
          is_playing: Boolean(p.is_playing),
          current_time: Number(p.current_time ?? 0),
          updated_at: Number(p.updated_at ?? Date.now() / 1000),
        };
        setPlayerState(next);
        if (roomId) {updateRoomSessionPlayer(roomId, next);}
        return;
      }
      if (msg.type === "QUEUE_UPDATE") {
        const q = (msg.payload as { queues: { main: QueueItem[]; sugg: QueueItem[] } }).queues;
        setQueues(q);
        return;
      }
      if (msg.type === "PARTICIPANTS_UPDATE") {
        setParticipants((msg.payload as { participants: Participant[] }).participants);
        return;
      }
      if (msg.type === "ROOM_UPDATE") {
        const p = msg.payload as { name: string; is_private: boolean; tags: string[] };
        applyRoomMeta({
          name: p.name,
          tags: p.tags ?? [],
          isPrivate: p.is_private,
        });
        return;
      }
      if (msg.type === "CHAT_MESSAGE") {
        const p = msg.payload as {
          text: string;
          display_name: string;
          participant_id: string;
          username?: string;
          sent_at: number;
        };
        setChat((prev) => [...prev, { kind: "user", ...p }]);
        return;
      }
      if (msg.type === "SYSTEM_MESSAGE") {
        const p = msg.payload as { text: string; event?: string; sent_at: number };
        setChat((prev) => [
          ...prev,
          { kind: "system", text: p.text, event: p.event, sent_at: p.sent_at },
        ]);
      }
    },
    [applyRoomMeta, navigate, roomId, toast],
  );

  const { connected, send } = useRoomSocket(
    roomId,
    Boolean(session?.joined),
    handleWs,
    handleSessionExpired,
  );

  const wsSend = (type: string, payload: Record<string, unknown>) => {
    if (!send(type, payload)) {
      toast("Нет соединения с сервером. Обновите страницу.", "error");
    }
  };

  if (loading || !session || !playerState) {
    return <p className="text-fastwatch-muted">Подключение к комнате...</p>;
  }

  const adminPlay = (t: number) =>
    wsSend("PLAYER_STATE", { action: "PLAY", current_time: t });
  const adminPause = (t: number) =>
    wsSend("PLAYER_STATE", { action: "PAUSE", current_time: t });
  const adminSeek = (t: number) =>
    wsSend("PLAYER_STATE", { action: "SEEK", current_time: t });

  const playFromQueue = (item: QueueItem) => {
    wsSend("PLAYER_STATE", {
      action: "SET_VIDEO",
      video_url: item.url,
      title: item.title || "",
      current_time: 0,
    });
  };

  const playNextInQueue = () => {
    if (!session.isAdmin || queues.main.length === 0) {return;}
    const idx = queues.main.findIndex((q) => q.url === playerState.video_url);
    const next = queues.main[idx + 1] ?? queues.main[0];
    if (next && next.url !== playerState.video_url) {playFromQueue(next);}
  };

  const handleCopyLink = async () => {
    if (!roomId) {return;}
    const ok = await copyRoomLink(roomId);
    toast(ok ? "Ссылка приглашения скопирована" : "Ошибка копирования", ok ? "success" : "error");
  };

  const handleUpdateRoom = async (newName: string, newTags: string[], isPrivate: boolean) => {
    if (!roomId || !session.isAdmin) {return;}
    try {
      const response = await apiFetch<{ name: string; tags: string[]; is_private: boolean }>(
        `/rooms/${roomId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: newName || "Новая комната",
            tags: newTags,
            is_private: isPrivate,
          }),
        },
      );
      setRoomName(response.name);
      setRoomTags(response.tags ?? []);
      setRoomIsPrivate(response.is_private);
      if (roomId) {
        saveRoomMeta(roomId, {
          name: response.name,
          tags: response.tags ?? [],
          isPrivate: response.is_private,
        });
      }
      toast("Комната обновлена", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка обновления", "error");
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomId || !session.isAdmin) {return;}
    setDeleteRoomLoading(true);
    try {
      await apiFetch(`/rooms/${roomId}`, { method: "DELETE" });
      removeRoomSession(roomId);
      toast("Комната закрыта", "success");
      navigate("/");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Не удалось закрыть комнату", "error");
    } finally {
      setDeleteRoomLoading(false);
    }
  };

  const onlineCount = participants.length;
  const mobileTabs = session.isAdmin
    ? [...MOBILE_TABS, { id: "admin" as RoomSidebarTab, label: "Админ", icon: "⚙️" }]
    : MOBILE_TABS;

  const sidebarProps = {
    isAdmin: session.isAdmin,
    participantId: session.participantId,
    chat,
    participants,
    queues,
    currentVideoUrl: playerState.video_url,
    onPlayItem: playFromQueue,
    onSendChat: (text: string) => wsSend("CHAT_MESSAGE", { text }),
    onAddSugg: (url: string, title: string) => wsSend("QUEUE_UPDATE", { action: "ADD_SUGG", url, title }),
    onAddMain: (url: string, title: string) => wsSend("QUEUE_UPDATE", { action: "ADD_MAIN", url, title }),
    onApprove: (index: number) => wsSend("QUEUE_UPDATE", { action: "APPROVE", index }),
    onRemove: (queue: "main" | "sugg", index: number) =>
      wsSend("QUEUE_UPDATE", { action: "REMOVE", queue, index }),
    onReorderMain: (items: QueueItem[]) => wsSend("QUEUE_UPDATE", { action: "REORDER_MAIN", items }),
    onKick: (targetId: string) => wsSend("ROOM_MODERATION", { action: "KICK", target_id: targetId }),
    onBan: (targetId: string) => wsSend("ROOM_MODERATION", { action: "BAN", target_id: targetId }),
    onMute: (targetId: string, mute: boolean) =>
      wsSend("ROOM_MODERATION", {
        action: mute ? "MUTE" : "UNMUTE",
        target_id: targetId,
      }),
    onGatherAll: () =>
      wsSend("ROOM_MODERATION", {
        action: "GATHER_ALL",
        current_time: getEffectiveTime(playerState),
      }),
    roomName,
    roomTags,
    roomIsPrivate,
    onUpdateRoom: handleUpdateRoom,
    onDeleteRoom: session.isAdmin ? handleDeleteRoom : undefined,
    deleteRoomLoading,
  };

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col gap-2 sm:gap-3 lg:h-[calc(100vh-8rem)] lg:min-h-[500px] lg:gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/" className="text-xs text-fastwatch-accent hover:underline sm:text-sm">
            ← Лобби
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold sm:text-xl">
              {roomName || `Комната ${roomId}`}
            </h2>
            {roomIsPrivate && (
              <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-200 sm:text-xs">
                Скрытая
              </span>
            )}
          </div>
          <p className="text-[11px] text-fastwatch-muted sm:text-xs">
            {connected ? "👥 Online" : "○ Переподключение..."} · {session.displayName}
            {session.isAdmin ? " (админ)" : ""}
          </p>
          <div
            className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-100 sm:mt-2 sm:px-3 sm:py-1 sm:text-xs"
            title="Текущий онлайн комнаты"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)] sm:h-2 sm:w-2" />
            <span>{onlineCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs hover:bg-white/5 sm:px-3 sm:text-sm"
          >
            Ссылка
          </button>
          {session.isAdmin && queues.main[0] && !playerState.video_url && (
            <button
              type="button"
              onClick={() => playFromQueue(queues.main[0])}
              className="rounded-lg bg-fastwatch-accent px-2.5 py-1.5 text-xs text-white sm:px-3 sm:text-sm"
            >
              Старт
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_320px] lg:gap-4 xl:grid-cols-[3fr_1fr]">
        <section className="flex min-h-0 flex-col">
          <SyncPlayer
            isAdmin={session.isAdmin}
            playerState={playerState}
            onAdminPlay={adminPlay}
            onAdminPause={adminPause}
            onAdminSeek={adminSeek}
            onEnded={playNextInQueue}
          />
        </section>

        <section className="hidden min-h-0 lg:block">
          <RoomSidebar {...sidebarProps} />
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-fastwatch-panel/95 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
          {mobileTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobilePanel(t.id)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] ${
                mobilePanel === t.id ? "text-fastwatch-accent" : "text-fastwatch-muted"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {mobilePanel && (
        <>
          <button
            type="button"
            aria-label="Закрыть панель"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMobilePanel(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[70dvh] flex-col rounded-t-2xl border border-white/10 bg-fastwatch-panel shadow-2xl lg:hidden">
            <RoomSidebar
              {...sidebarProps}
              forcedTab={mobilePanel}
              onTabChange={setMobilePanel}
              onClose={() => setMobilePanel(null)}
            />
          </div>
        </>
      )}

      <div className="h-14 shrink-0 lg:hidden" aria-hidden />
    </div>
  );
}
