import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, type ProfilePublic } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { profilePath } from "../../lib/links";
import type { Participant } from "../../types/room";

type Props = {
  participant: Participant;
  participantId: string;
  isAdmin: boolean;
  onKick: (targetId: string) => void;
  onBan: (targetId: string) => void;
  onMute: (targetId: string, mute: boolean) => void;
};

export default function ParticipantRow({
  participant: p,
  participantId,
  isAdmin,
  onKick,
  onBan,
  onMute,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSelf = p.id === participantId;
  const canProfile = Boolean(p.username && !p.is_guest);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!user || !p.username || isSelf) {
      setIsFollowing(null);
      return;
    }
    let cancelled = false;
    apiFetch<ProfilePublic>(`/profile/${encodeURIComponent(p.username)}`)
      .then((profile) => {
        if (!cancelled) {setIsFollowing(profile.is_following);}
      })
      .catch(() => {
        if (!cancelled) {setIsFollowing(false);}
      });
    return () => {
      cancelled = true;
    };
  }, [isSelf, p.username, user]);

  const follow = async () => {
    if (!user || !p.username) {return;}
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const result = await apiFetch<{ is_following: boolean }>(
        `/profile/${encodeURIComponent(p.username)}/follow`,
        { method },
      );
      setIsFollowing(result.is_following);
      toast(
        result.is_following ? `Вы подписались на ${p.username}` : `Вы отписались от ${p.username}`,
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка", "error");
    } finally {
      setFollowLoading(false);
    }
  };

  const block = async () => {
    if (!user || !p.username) {return;}
    try {
      await apiFetch(`/profile/${encodeURIComponent(p.username)}/block`, { method: "POST" });
      toast(`${p.username} заблокирован — не сможет войти в ваши комнаты`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка", "error");
    }
  };

  return (
    <li className="rounded border border-white/10 px-2 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {canProfile ? (
            <Link
              to={profilePath(p.username!)}
              className="truncate font-medium text-fastwatch-accent hover:underline"
            >
              {p.display_name}
            </Link>
          ) : (
            <span className="truncate font-medium">{p.display_name}</span>
          )}
          <p className="text-xs text-fastwatch-muted">
            {p.role}
            {p.is_muted ? " · 🔇 мут" : ""}
          </p>
        </div>
      </div>

      {!isSelf && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {canProfile && user && (
            <>
              <ActionBtn
                onClick={follow}
                label={isFollowing ? "Отписаться" : "Подписаться"}
                color="text-fastwatch-accent"
                disabled={followLoading || isFollowing === null}
              />
              <ActionBtn onClick={block} label="Блок" color="text-orange-300" />
            </>
          )}
          {isAdmin && (
            <>
              <ActionBtn
                onClick={() => onMute(p.id, !p.is_muted)}
                label={p.is_muted ? "Размут" : "Мут"}
                color="text-purple-300"
              />
              <ActionBtn onClick={() => onKick(p.id)} label="Кик" color="text-yellow-400" />
              {!p.is_guest && (
                <ActionBtn onClick={() => onBan(p.id)} label="Бан" color="text-red-400" />
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function ActionBtn({
  onClick,
  label,
  color,
  disabled,
}: {
  onClick: () => void;
  label: string;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`text-xs ${color} hover:underline disabled:opacity-50`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
