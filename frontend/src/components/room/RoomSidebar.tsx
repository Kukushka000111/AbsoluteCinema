import { FormEvent, useState } from "react";
import type { ChatMessage, Participant, QueueItem } from "../../types/room";

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
  onGatherAll: () => void;
  roomName?: string;
  roomTags?: string[];
  onUpdateRoom?: (name: string, tags: string[]) => void;
};

export default function RoomSidebar(props: Props) {
  const [tab, setTab] = useState<Tab>("chat");
  const tabs: Tab[] = props.isAdmin ? ["chat", "queue", "users", "admin"] : ["chat", "queue", "users"];

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-fastwatch-panel">
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "chat" && <ChatTab {...props} />}
        {tab === "queue" && <QueueTab {...props} />}
        {tab === "users" && <UsersTab {...props} />}
        {tab === "admin" && <AdminTab {...props} />}
      </div>
    </aside>
  );
}

function ChatTab({ chat, onSendChat }: Pick<Props, "chat" | "onSendChat">) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendChat(text.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-col">
      <ul className="mb-3 flex-1 space-y-2 overflow-y-auto text-sm">
        {chat.map((m, i) => (
          <li key={`${m.sent_at}-${i}`}>
            <span className="font-medium text-fastwatch-accent">{m.display_name}: </span>
            {m.text}
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-fastwatch-bg px-3 py-2 text-sm"
          placeholder="Сообщение..."
        />
        <button type="submit" className="rounded-lg bg-fastwatch-accent px-3 py-2 text-sm">
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
    if (!url.trim()) return;
    if (isAdmin) onAddMain(url.trim(), title.trim());
    else onAddSugg(url.trim(), title.trim());
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
          className="w-full rounded border border-white/10 bg-fastwatch-bg px-2 py-1"
        />
        <p className="text-[11px] leading-snug text-fastwatch-muted">{SUPPORTED_SOURCES_HINT}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название (опционально)"
          className="w-full rounded border border-white/10 bg-fastwatch-bg px-2 py-1"
        />
        <button
          type="button"
          onClick={add}
          className="w-full rounded bg-fastwatch-accent py-1.5 text-white"
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
  onGatherAll,
}: Pick<Props, "isAdmin" | "participantId" | "participants" | "onKick" | "onBan" | "onGatherAll">) {
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
          <li
            key={p.id}
            className="flex items-center justify-between rounded border border-white/10 px-2 py-1"
          >
            <span>
              {p.display_name} <span className="text-xs text-fastwatch-muted">({p.role})</span>
            </span>
            {isAdmin && p.id !== participantId && (
              <span className="flex gap-1">
                <button type="button" className="text-xs text-yellow-400" onClick={() => onKick(p.id)}>
                  Кик
                </button>
                {!p.is_guest && (
                  <button type="button" className="text-xs text-red-400" onClick={() => onBan(p.id)}>
                    Бан
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminTab({
  roomName = "",
  roomTags = [],
  onUpdateRoom,
}: Pick<Props, "roomName" | "roomTags" | "onUpdateRoom">) {
  const [editName, setEditName] = useState(roomName);
  const [editTags, setEditTags] = useState(roomTags.join(", "));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!onUpdateRoom) return;
    const tags = editTags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    onUpdateRoom(editName.trim(), tags);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-fastwatch-bg p-3">
        <label className="block text-xs font-medium text-fastwatch-muted mb-2">Название комнаты</label>
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full rounded border border-white/10 bg-fastwatch-panel px-3 py-2 text-sm mb-3"
          placeholder="Введите название"
        />
        <label className="block text-xs font-medium text-fastwatch-muted mb-2">
          Теги (через запятую)
        </label>
        <input
          value={editTags}
          onChange={(e) => setEditTags(e.target.value)}
          className="w-full rounded border border-white/10 bg-fastwatch-panel px-3 py-2 text-sm mb-3"
          placeholder="кино, музыка, аниме"
        />
        <button
          type="button"
          onClick={handleSave}
          className={`w-full py-2 rounded font-medium transition ${
            saved
              ? "bg-green-600 text-white"
              : "bg-fastwatch-accent hover:bg-fastwatch-accentDark text-white"
          }`}
        >
          {saved ? "✓ Сохранено" : "💾 Сохранить"}
        </button>
      </div>

      <div className="text-xs text-fastwatch-muted bg-fastwatch-bg p-3 rounded-lg">
        <p className="font-medium mb-2">💡 Панель администратора</p>
        <p>• Здесь вы можете менять название и теги комнаты</p>
        <p className="mt-1">• Изменения будут видны всем участникам</p>
      </div>
    </div>
  );
}
