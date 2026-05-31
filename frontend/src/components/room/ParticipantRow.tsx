import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { profilePath } from "../../lib/links";
import type { Participant } from "../../types/room";

export type ParticipantRelation = {
  is_following: boolean;
  is_blocked: boolean;
};

type Props = {
  participant: Participant;
  participantId: string;
  isAdmin: boolean;
  relation?: ParticipantRelation | null;
  onRelationChange?: (username: string, relation: ParticipantRelation) => void;
  onKick: (targetId: string) => void;
  onBan: (targetId: string) => void;
  onMute: (targetId: string, mute: boolean) => void;
};

export default function ParticipantRow({
  participant: p,
  participantId,
  isAdmin,
  relation = null,
  onRelationChange,
  onKick,
  onBan,
  onMute,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSelf = p.id === participantId;
  const canProfile = Boolean(p.username && !p.is_guest);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const isFollowing = relation?.is_following ?? false;
  const isBlocked = relation?.is_blocked ?? false;

  const follow = async () => {
    if (!user || !p.username) {return;}
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const result = await apiFetch<{ is_following: boolean }>(
        `/profile/${encodeURIComponent(p.username)}/follow`,
        { method },
      );
      onRelationChange?.(p.username, {
        is_following: result.is_following,
        is_blocked: isBlocked,
      });
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

  const toggleBlock = async () => {
    if (!user || !p.username) {return;}
    setBlockLoading(true);
    try {
      const method = isBlocked ? "DELETE" : "POST";
      const result = await apiFetch<{ is_blocked: boolean }>(
        `/profile/${encodeURIComponent(p.username)}/block`,
        { method },
      );
      onRelationChange?.(p.username, {
        is_following: isFollowing,
        is_blocked: result.is_blocked,
      });
      toast(
        result.is_blocked
          ? `${p.username} заблокирован — не сможет войти в ваши комнаты`
          : `${p.username} разблокирован`,
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Ошибка", "error");
    } finally {
      setBlockLoading(false);
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
            {isBlocked ? " · заблокирован" : ""}
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
                disabled={followLoading || relation === null || isBlocked}
              />
              <ActionBtn
                onClick={toggleBlock}
                label={isBlocked ? "Разблок." : "Блок"}
                color={isBlocked ? "text-emerald-300" : "text-orange-300"}
                disabled={blockLoading || relation === null}
              />
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
