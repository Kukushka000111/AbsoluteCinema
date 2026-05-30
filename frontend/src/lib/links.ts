export function roomPath(roomId: string): string {
  return `/room/${roomId}`;
}

export function profilePath(username: string): string {
  return `/profile/${username}`;
}

export function editProfilePath(): string {
  return "/profile/me/edit";
}

export function adminPath(): string {
  return "/admin";
}

export function roomAbsoluteUrl(roomId: string): string {
  return `${window.location.origin}${roomPath(roomId)}`;
}

export async function copyRoomLink(roomId: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(roomAbsoluteUrl(roomId));
    return true;
  } catch {
    return false;
  }
}
