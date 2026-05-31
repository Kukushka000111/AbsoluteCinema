import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import type { ChatMessage, Participant, QueueItem } from "../../types/room";
import { profilePath } from "../../lib/links";
import ParticipantRow, { type ParticipantRelation } from "./ParticipantRow";

type Tab = "chat" | "queue" | "users" | "admin";

type Props = {
  isAdmin: boolean;
  participantId: string;
  chat: ChatMessage[];
  participants: Participant[];
  queues: { main: QueueItem[]; sugg: QueueItem[] };
  onSendChat: (text: string) => void;
  onAddSugg: (url: string, title: string) => void;
  onAddMain: (url: string, title: string) => void;
  onApprove: (index: number) => void;
  onRemove: (queue: "main" | "sugg", index: number) => void;
  onReorderMain: (items: QueueItem[]) => void;
  currentVideoUrl: string;
  onPlayItem: (item: QueueItem) => void;
  onKick: (targetId: string) => void;
  onBan: (targetId: string) => void;
  onMute: (targetId: string, mute: boolean) => void;
  onGatherAll: () => void;
  roomName?: string;
  roomTags?: string[];
  roomIsPrivate?: boolean;
  onUpdateRoom?: (name: string, tags: string[], isPrivate: boolean) => void;
  onDeleteRoom?: () => void;
  deleteRoomLoading?: boolean;
  forcedTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  hideTabBar?: boolean;
  onClose?: () => void;
};

export default function RoomSidebar(props: Props) {
  const [internalTab, setInternalTab] = useState<Tab>("chat");
  const tab = props.forcedTab ?? internalTab;
  const setTab = (t: Tab) => {
    props.onTabChange?.(t);
    if (!props.forcedTab) {setInternalTab(t);}
  };
  const tabs: Tab[] = props.isAdmin ? ["chat", "queue", "users", "admin"] : ["chat", "queue", "users"];

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-fastwatch-panel lg:rounded-xl lg:border lg:border-white/10">
      {props.onClose && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 lg:hidden">
          <span className="text-sm font-medium capitalize">
            {tab === "chat" ? "Чат" : tab === "queue" ? "Очередь" : tab === "users" ? "Участники" : "Админ"}
          </span>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-2 py-1 text-sm text-fastwatch-muted hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {!props.hideTabBar && (
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize whitespace-nowrap ${
                tab === t ? "border-b-2 border-fastwatch-accent text-white" : "text-fastwatch-muted"
              }`}
            >
              {t === "chat" ? "Чат" : t === "queue" ? "Очередь" : t === "users" ? "Участники" : "⚙️ Админ"}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "chat" && <ChatTab {...props} />}
        {tab === "queue" && <QueueTab {...props} />}
        {tab === "users" && <UsersTab {...props} />}
        {tab === "admin" && <AdminTab {...props} />}
      </div>
    </aside>
  );
}

function ChatTab({
  chat,
  onSendChat,
  participants,
  participantId,
}: Pick<Props, "chat" | "onSendChat" | "participants" | "participantId">) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const usernameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      if (p.username) {map.set(p.id, p.username);}
    }
    return map;
  }, [participants]);
  const selfMuted = participants.find((p) => p.id === participantId)?.is_muted ?? false;

  useEffect(() => {
    const el = listRef.current;
    if (el) {el.scrollTop = el.scrollHeight;}
  }, [chat.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {return;}
    onSendChat(text.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <ul ref={listRef} className="mb-3 flex-1 space-y-2 overflow-y-auto text-sm">
        {chat.length === 0 && (
          <li className="py-4 text-center text-xs italic text-fastwatch-muted/70">
            Системные события и сообщения появятся здесь
          </li>
        )}
        {chat.map((m, i) =>
          m.kind === "system" ? (
            <li key={`sys-${m.sent_at}-${i}`} className="py-0.5 text-center">
              <span className="text-xs italic text-amber-200/75">{m.text}</span>
            </li>
          ) : (
            <li key={`${m.sent_at}-${i}`}>
              {(() => {
                const username = m.username ?? usernameById.get(m.participant_id);
                return username ? (
                  <>
                    <Link
                      to={profilePath(username)}
                      className="font-medium text-fastwatch-accent hover:underline"
                    >
                      {m.display_name}
                    </Link>
                    : {m.text}
                  </>
                ) : (
                  <>
                    <span className="font-medium text-fastwatch-accent">{m.display_name}: </span>
                    {m.text}
                  </>
                );
              })()}
            </li>
          ),
        )}
      </ul>
      {selfMuted && (
        <p className="mb-2 text-xs text-amber-200/80">Вы замучены и не можете писать в чат</p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={selfMuted}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm disabled:opacity-50"
          placeholder={selfMuted ? "Чат отключён" : "Сообщение..."}
        />
        <button
          type="submit"
          disabled={selfMuted}
          className="shrink-0 rounded-lg bg-fastwatch-accent px-3 py-2 text-sm disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}

const SUPPORTED_SOURCES_HINT =
  "YouTube, Rutube, Vimeo, Twitch, SoundCloud, Facebook, Streamable, Wistia, DailyMotion, Mixcloud, Kaltura, Vidyard, прямые ссылки .mp4 / .webm / .m3u8 (HLS).";

function QueueTab({
  isAdmin,
  queues,
  currentVideoUrl,
  onAddSugg,
  onAddMain,
  onApprove,
  onRemove,
  onReorderMain,
  onPlayItem,
}: Pick<
  Props,
  | "isAdmin"
  | "queues"
  | "currentVideoUrl"
  | "onAddSugg"
  | "onAddMain"
  | "onApprove"
  | "onRemove"
  | "onReorderMain"
  | "onPlayItem"
>) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const add = () => {
    if (!url.trim()) {return;}
    if (isAdmin) {onAddMain(url.trim(), title.trim());}
    else {onAddSugg(url.trim(), title.trim());}
    setUrl("");
    setTitle("");
  };

  const onDrop = (to: number) => {
    if (!isAdmin || dragIdx === null || dragIdx === to) {
      finishDrag();
      return;
    }
    const items = [...queues.main];
    const [moved] = items.splice(dragIdx, 1);
    items.splice(to, 0, moved);
    onReorderMain(items);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const finishDrag = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://rutube.ru/video/..."
          className="w-full rounded border border-white/10 bg-fastwatch-bg px-2 py-1.5 text-sm"
        />
        <p className="text-[11px] leading-snug text-fastwatch-muted">{SUPPORTED_SOURCES_HINT}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название (опционально)"
          className="w-full rounded border border-white/10 bg-fastwatch-bg px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={add}
          className="w-full rounded bg-fastwatch-accent py-2 text-sm text-white"
        >
          {isAdmin ? "В основной плейлист" : "В предложку"}
        </button>
      </div>

      <div>
        <h4 className="mb-2 font-medium">
          Плейлист
          {isAdmin && (
            <span className="ml-2 text-xs font-normal text-fastwatch-muted">
              — «Включить» для переключения
            </span>
          )}
        </h4>
        <ul className="space-y-1" onDragLeave={() => setDragOverIdx(null)}>
          {queues.main.map((item, i) => {
            const isActive = Boolean(currentVideoUrl && item.url === currentVideoUrl);
            return (
              <li
                key={`${item.url}-${i}`}
                draggable={isAdmin}
                onDragStart={() => setDragIdx(i)}
                onDragEnter={() => isAdmin && setDragOverIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={finishDrag}
                className={`rounded border px-2 py-1.5 transition ${
                  isActive
                    ? "border-fastwatch-accent bg-fastwatch-accent/10"
                    : "border-white/10 bg-fastwatch-bg"
                } ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""} ${
                  dragIdx === i ? "opacity-60" : ""
                } ${dragOverIdx === i && dragIdx !== i ? "ring-1 ring-fastwatch-accent" : ""}`}
              >
                <p className="truncate font-medium">
                  {i + 1}. {item.title || item.url}
                  {isActive && (
                    <span className="ml-1 text-xs text-fastwatch-accent"> (сейчас)</span>
                  )}
                </p>
                {isAdmin && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="text-xs font-medium text-fastwatch-accent hover:underline"
                      onClick={() => onPlayItem(item)}
                    >
                      ▶ Включить
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:underline"
                      onClick={() => onRemove("main", i)}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {queues.main.length === 0 && (
          <p className="text-xs text-fastwatch-muted">Плейлист пуст — добавьте ссылку выше</p>
        )}
      </div>

      <div>
        <h4 className="mb-2 font-medium">Предложка</h4>
        <ul className="space-y-1">
          {queues.sugg.map((item, i) => (
            <li key={`${item.url}-${i}`} className="rounded border border-white/10 px-2 py-1">
              <p className="truncate">{item.title || item.url}</p>
              {isAdmin && (
                <button
                  type="button"
                  className="mt-1 text-xs text-fastwatch-accent"
                  onClick={() => onApprove(i)}
                >
                  ✓ В плейлист
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UsersTab({
  isAdmin,
  participantId,
  participants,
  onKick,
  onBan,
  onMute,
  onGatherAll,
}: Pick<
  Props,
  "isAdmin" | "participantId" | "participants" | "onKick" | "onBan" | "onMute" | "onGatherAll"
>) {
  const { user } = useAuth();
  const [relations, setRelations] = useState<Record<string, ParticipantRelation>>({});

  const usernamesKey = useMemo(
    () =>
      participants
        .filter((p) => p.username && !p.is_guest && p.id !== participantId)
        .map((p) => p.username!)
        .sort()
        .join(","),
    [participantId, participants],
  );

  useEffect(() => {
    if (!user || !usernamesKey) {
      setRelations({});
      return;
    }
    let cancelled = false;
    apiFetch<Record<string, ParticipantRelation>>(
      `/profile/relations?usernames=${encodeURIComponent(usernamesKey)}`,
    )
      .then((data) => {
        if (!cancelled) {setRelations(data);}
      })
      .catch(() => {
        if (!cancelled) {setRelations({});}
      });
    return () => {
      cancelled = true;
    };
  }, [user, usernamesKey]);

  return (
    <div className="space-y-2 text-sm">
      {isAdmin && (
        <button
          type="button"
          onClick={() => onGatherAll()}
          className="mb-3 w-full rounded-lg bg-fastwatch-accent py-2 text-white"
        >
          Собрать всех
        </button>
      )}
      <ul className="space-y-2">
        {participants.map((p) => (
          <ParticipantRow
            key={p.id}
            participant={p}
            participantId={participantId}
            isAdmin={isAdmin}
            relation={p.username ? relations[p.username] ?? null : null}
            onRelationChange={(username, relation) =>
              setRelations((prev) => ({ ...prev, [username]: relation }))
            }
            onKick={onKick}
            onBan={onBan}
            onMute={onMute}
          />
        ))}
      </ul>
    </div>
  );
}

function AdminTab({
  roomName = "",
  roomTags = [],
  roomIsPrivate = false,
  onUpdateRoom,
  onDeleteRoom,
  deleteRoomLoading = false,
}: Pick<
  Props,
  | "roomName"
  | "roomTags"
  | "roomIsPrivate"
  | "onUpdateRoom"
  | "onDeleteRoom"
  | "deleteRoomLoading"
>) {
  const tagsLabel = roomTags.join(", ");
  const [editName, setEditName] = useState(roomName);
  const [editTags, setEditTags] = useState(tagsLabel);
  const [editPrivate, setEditPrivate] = useState(roomIsPrivate);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditName(roomName);
    setEditTags(tagsLabel);
    setEditPrivate(roomIsPrivate);
  }, [roomName, tagsLabel, roomIsPrivate]);

  const handleSave = () => {
    if (!onUpdateRoom) {return;}
    const tags = editTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onUpdateRoom(editName.trim(), tags, editPrivate);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-fastwatch-bg p-3">
        <label className="mb-2 block text-xs font-medium text-fastwatch-muted">Название комнаты</label>
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="mb-3 w-full rounded border border-white/10 bg-fastwatch-panel px-3 py-2 text-sm"
          placeholder={roomName || "Название комнаты"}
        />
        <label className="mb-2 block text-xs font-medium text-fastwatch-muted">
          Теги (через запятую)
        </label>
        <input
          value={editTags}
          onChange={(e) => setEditTags(e.target.value)}
          className="mb-3 w-full rounded border border-white/10 bg-fastwatch-panel px-3 py-2 text-sm"
          placeholder={tagsLabel || "кино, музыка, аниме"}
        />
        <label className="mb-3 flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-fastwatch-panel px-3 py-2.5">
          <input
            type="checkbox"
            checked={editPrivate}
            onChange={(e) => setEditPrivate(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-fastwatch-accent"
          />
          <span>
            <span className="block font-medium">Скрытая комната</span>
            <span className="text-xs text-fastwatch-muted">
              Не отображается в каталоге. Для входа нужен аккаунт и ссылка.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={handleSave}
          className={`w-full rounded py-2 font-medium transition ${
            saved
              ? "bg-green-600 text-white"
              : "bg-fastwatch-accent text-white hover:bg-fastwatch-accentDark"
          }`}
        >
          {saved ? "✓ Сохранено" : "💾 Сохранить"}
        </button>
      </div>

      <div className="rounded-lg bg-fastwatch-bg p-3 text-xs text-fastwatch-muted">
        <p className="mb-2 font-medium">💡 Панель администратора</p>
        <p>• Меняйте название, теги и приватность комнаты</p>
        <p className="mt-1">• Изменения видны всем участникам в чате</p>
        <p className="mt-1">• Пустая комната без входов удаляется через 1 час</p>
      </div>

      {onDeleteRoom && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-500/10"
            >
              Закрыть комнату
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-100">
                Комната будет удалена без восстановления. Все участники будут отключены.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deleteRoomLoading}
                  onClick={onDeleteRoom}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteRoomLoading ? "..." : "Подтвердить"}
                </button>
                <button
                  type="button"
                  disabled={deleteRoomLoading}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { Tab as RoomSidebarTab };
