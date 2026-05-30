type Props = {
  username: string;
  avatarUrl: string;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-xl",
  lg: "h-24 w-24 text-3xl",
};

export default function UserAvatar({ username, avatarUrl, size = "md" }: Props) {
  const initials = username.slice(0, 1).toUpperCase();
  const isDefault = avatarUrl.includes("default.png");

  if (!isDefault && avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizes[size]} shrink-0 rounded-full border border-white/10 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full border border-fastwatch-accent/30 bg-fastwatch-accent/20 font-bold text-fastwatch-accent`}
    >
      {initials}
    </div>
  );
}

export function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const VISIBILITY_LABELS: Record<string, string> = {
  public: "Публичный",
  subscribers: "Только подписчики",
  hidden: "Скрытый",
};
