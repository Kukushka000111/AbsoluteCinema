export function normalizeTelegramUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) {return null;}
  const raw = value.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {return raw;}
  if (raw.startsWith("t.me/")) {return `https://${raw}`;}
  const username = raw.replace(/^@/, "");
  return username ? `https://t.me/${username}` : null;
}

export function normalizeVkUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) {return null;}
  const raw = value.trim();
  if (raw.startsWith("http://") || raw.startsWith("https://")) {return raw;}
  if (raw.startsWith("vk.com/") || raw.startsWith("m.vk.com/")) {return `https://${raw}`;}
  const path = raw.replace(/^@/, "");
  return path ? `https://vk.com/${path}` : null;
}
