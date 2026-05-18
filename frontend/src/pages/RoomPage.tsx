import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, ensureGuestSession, loadGuestSession, type JoinRoomResponse } from "../api/client";
import { useAuth } from "../context/AuthContext";
import RoomSidebar from "../components/room/RoomSidebar";
import SyncPlayer from "../components/room/SyncPlayer";
import { useRoomSocket, type WsMessage } from "../hooks/useRoomSocket";
import { loadRoomSession, saveRoomSession, updateRoomSessionPlayer } from "../lib/roomSession";
import type { ChatMessage, Participant, PlayerState, QueueItem } from "../types/room";
import { useToast } from "../context/ToastContext";
import { copyRoomLink } from "../lib/links";
import { getEffectiveTime } from "../types/room";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [session, setSession] = useState(() => (roomId ? loadRoomSession(roomId) : null));
  const [playerState, setPlayerState] = useState<PlayerState | null>(session?.playerState ?? null);
  const [queues, setQueues] = useState<{ main: QueueItem[]; sugg: QueueItem[] }>({ main: [], sugg: [] });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [roomName, setRoomName] = useState("");
  const [roomTags, setRoomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(!session);

  const ensureJoin = useCallback(async () => {
    if (!roomId) return;
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
    setRoomName(join.room.name);
    setRoomTags(join.room.tags ?? []);
    setLoading(false);
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;
    if (session?.wsToken) {
      setLoading(false);
      return;
    }
    ensureJoin().catch(() => navigate("/"));
  }, [roomId, session?.wsToken, ensureJoin, navigate]);

  const handleWs = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "KICKED" || msg.type === "BANNED") {
        toast(
          msg.type === "BANNED" ? "Вы забанены в этой комнате" : "Вас исключили из комнаты",
          "error",
        );
        navigate("/");
        return;
      }
      if (msg.type === "ERROR") {
        const detail = (msg.payload as { detail?: string })?.detail;
        if (detail) console.warn(detail);
        return;
      }
      if (msg.type === "CONNECTED") {
        const p = msg.payload as {
          player_state: PlayerState;
          queues: { main: QueueItem[]; sugg: QueueItem[] };
          participants: Participant[];
        };
        setPlayerState(p.player_state);
        setQueues(p.queues);
        setParticipants(p.participants);
        if (roomId) updateRoomSessionPlayer(roomId, p.player_state);
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
        if (roomId) updateRoomSessionPlayer(roomId, next);
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
      if (msg.type === "CHAT_MESSAGE") {
        setChat((prev) => [...prev, msg.payload as unknown as ChatMessage]);
      }
    },
    [navigate, roomId, toast],
  );

  const { connected, send } = useRoomSocket(roomId, session?.wsToken, handleWs);

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
    if (!session.isAdmin || queues.main.length === 0) return;
    const idx = queues.main.findIndex((q) => q.url === playerState.video_url);
    const next = queues.main[idx + 1] ?? queues.main[0];
    if (next && next.url !== playerState.video_url) playFromQueue(next);
  };

  const handleCopyLink = async () => {
    if (!roomId) return;
    const ok = await copyRoomLink(roomId);
    toast(ok ? "Ссылка приглашения скопирована" : "Ошибка копирования", ok ? "success" : "error");
  };

  const handleUpdateRoom = async (newName: string, newTags: string[]) => {
    if (!roomId || !session.isAdmin) return;
    try {
      const response = await apiFetch<any>(`/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: newName || "Новая комната",
          tags: newTags,
        }),
      });
      setRoomName(response.name);
      setRoomTags(response.tags ?? []);
      toast("Комната обновлена", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка обновления", "error");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[500px] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Link to="/" className="text-sm text-fastwatch-accent hover:underline">
            ← Лобби
          </Link>
          <h2 className="text-xl font-semibold">{roomName || `Комната ${roomId}`}</h2>
          <p className="text-xs text-fastwatch-muted">
            {connected ? "● Online" : "○ Переподключение..."} · {session.displayName}
            {session.isAdmin ? " (админ)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Копировать ссылку
          </button>
          {session.isAdmin && queues.main[0] && !playerState.video_url && (
            <button
              type="button"
              onClick={() => playFromQueue(queues.main[0])}
              className="rounded-lg bg-fastwatch-accent px-3 py-1.5 text-sm text-white"
            >
              Старт: {queues.main[0].title || "первое видео"}
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[3fr_1fr]">
        <section className="min-h-0">
          <SyncPlayer
            isAdmin={session.isAdmin}
            playerState={playerState}
            onAdminPlay={adminPlay}
            onAdminPause={adminPause}
            onAdminSeek={adminSeek}
            onEnded={playNextInQueue}
          />
        </section>
        <section className="min-h-[320px] lg:min-h-0">
          <RoomSidebar
            isAdmin={session.isAdmin}
            participantId={session.participantId}
            chat={chat}
            participants={participants}
            queues={queues}
            currentVideoUrl={playerState.video_url}
            onPlayItem={playFromQueue}
            onSendChat={(text) => wsSend("CHAT_MESSAGE", { text })}
            onAddSugg={(url, title) => wsSend("QUEUE_UPDATE", { action: "ADD_SUGG", url, title })}
            onAddMain={(url, title) => wsSend("QUEUE_UPDATE", { action: "ADD_MAIN", url, title })}
            onApprove={(index) => wsSend("QUEUE_UPDATE", { action: "APPROVE", index })}
            onRemove={(queue, index) => wsSend("QUEUE_UPDATE", { action: "REMOVE", queue, index })}
            onReorderMain={(items) => wsSend("QUEUE_UPDATE", { action: "REORDER_MAIN", items })}
            onKick={(targetId) => wsSend("ROOM_MODERATION", { action: "KICK", target_id: targetId })}
            onBan={(targetId) => wsSend("ROOM_MODERATION", { action: "BAN", target_id: targetId })}
            onGatherAll={() =>
              wsSend("ROOM_MODERATION", {
                action: "GATHER_ALL",
                current_time: getEffectiveTime(playerState),
              })
            }
            roomName={roomName}
            roomTags={roomTags}
            onUpdateRoom={handleUpdateRoom}
          />
        </section>
      </div>
    </div>
  );
}
