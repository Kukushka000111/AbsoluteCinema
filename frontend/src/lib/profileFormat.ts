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
