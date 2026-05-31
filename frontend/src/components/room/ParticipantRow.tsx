import { Link } from "react-router-dom";
import { profilePath } from "../../lib/links";
import type { Participant } from "../../types/room";

type Props = {
  participant: Participant;
  participantId: string;
  isAdmin: boolean;
  onKick: (targetId: string) => void;
  onMute: (targetId: string, mute: boolean) => void;
};

export default function ParticipantRow({
  participant: p,
  participantId,
  isAdmin,
  onKick,
  onMute,
}: Props) {
  const isSelf = p.id === participantId;
  const canProfile = Boolean(p.username && !p.is_guest);

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

      {!isSelf && isAdmin && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <ActionBtn
            onClick={() => onMute(p.id, !p.is_muted)}
            label={p.is_muted ? "Размут" : "Мут"}
            color="text-purple-300"
          />
          <ActionBtn onClick={() => onKick(p.id)} label="Кик" color="text-yellow-400" />
        </div>
      )}
    </li>
  );
}

function ActionBtn({
  onClick,
  label,
  color,
}: {
  onClick: () => void;
  label: string;
  color: string;
}) {
  return (
    <button
      type="button"
      className={`text-xs ${color} hover:underline`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
