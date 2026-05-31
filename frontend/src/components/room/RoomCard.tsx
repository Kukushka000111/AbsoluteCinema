import { Link } from "react-router-dom";
import type { RoomPublic } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { copyRoomLink, roomPath } from "../../lib/links";

type Props = {
  room: RoomPublic;
  onJoin?: (id: string) => void;
  showHistoryLink?: boolean;
};

export default function RoomCard({ room, onJoin, showHistoryLink }: Props) {
  const { toast } = useToast();

  const copyLink = async () => {
    const ok = await copyRoomLink(room.id);
    toast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  };

  return (
    <article className="flex flex-col rounded-xl border border-white/10 bg-fastwatch-panel p-4 transition hover:border-fastwatch-accent/60 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{room.name}</h3>
        {room.is_private && (
          <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-200">
            Скрытая
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-fastwatch-muted">
        {room.admin.username} · онлайн: {room.online_count}
      </p>
      {room.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {room.tags.map((tag: string) => (
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
        {onJoin ? (
          <button
            type="button"
            onClick={() => onJoin(room.id)}
            className="flex-1 rounded-lg bg-fastwatch-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-fastwatch-accentDark"
          >
            Войти
          </button>
        ) : (
          <Link
            to={roomPath(room.id)}
            className="flex-1 rounded-lg bg-fastwatch-accent px-3 py-2 text-center text-sm font-medium text-white transition hover:bg-fastwatch-accentDark"
          >
            Войти
          </Link>
        )}
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
