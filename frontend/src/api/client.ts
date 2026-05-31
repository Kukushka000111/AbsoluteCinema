const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") {return data.detail;}
    if (Array.isArray(data?.detail)) {return data.detail[0]?.msg ?? res.statusText;}
  } catch {
    /* ignore */
  }
  return res.statusText || "Ошибка запроса";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export interface UserPublic {
  id: string;
  username: string;
  avatar_url: string;
  is_global_admin?: boolean;
  is_globally_banned?: boolean;
  global_ban_reason?: string | null;
}

export interface AuthAvailability {
  username_valid: boolean;
  username_available: boolean;
  username_message: string | null;
  email_valid: boolean;
  email_available: boolean;
  email_message: string | null;
}

export interface RoomPublic {
  id: string;
  name: string;
  is_private: boolean;
  tags: string[];
  created_at: string;
  admin: UserPublic;
  online_count: number;
}

export interface LobbyListResponse {
  items: RoomPublic[];
  total: number;
  limit: number;
  offset: number;
}

export interface PlayerStateSnapshot {
  video_url: string;
  is_playing: boolean;
  current_time: number;
  updated_at: number;
}

export interface JoinRoomResponse {
  room: RoomPublic;
  player_state: PlayerStateSnapshot;
  participant_id: string;
  display_name: string;
  is_admin: boolean;
  is_guest: boolean;
  guest_id?: string | null;
  ws_token: string;
}

export interface GuestSession {
  guest_id: string;
  display_name: string;
}

export type ProfileVisibility = "public" | "subscribers" | "hidden";

export interface ProfileLinks {
  telegram: string | null;
  vk: string | null;
  twitch: string | null;
}

export interface WatchingNow {
  room_id: string;
  room_name: string;
}

export interface RecentRoomVisit {
  room_id: string;
  room_name: string;
  visited_at: string;
}

export interface ProfilePublic {
  username: string;
  created_at: string;
  bio: string | null;
  tags: string[];
  links: ProfileLinks;
  profile_visibility: ProfileVisibility;
  is_own_profile: boolean;
  is_following: boolean;
  is_blocked: boolean;
  followers_count: number;
  following_count: number;
  can_view_full: boolean;
  watching_now: WatchingNow | null;
  recent_rooms: RecentRoomVisit[];
}

export interface ProfileMe {
  id: string;
  username: string;
  email: string | null;
  bio: string | null;
  tags: string[];
  links: ProfileLinks;
  profile_visibility: ProfileVisibility;
  created_at: string;
  followers_count: number;
  following_count: number;
  watching_now: WatchingNow | null;
}

export interface ProfileUpdate {
  bio?: string | null;
  tags?: string[];
  link_telegram?: string | null;
  link_vk?: string | null;
  link_twitch?: string | null;
  profile_visibility?: ProfileVisibility;
  email?: string | null;
}

export interface WatchHistoryEntry {
  id: string;
  room_id: string;
  room_name: string;
  video_url: string;
  title: string | null;
  started_at: string;
}

export interface GlobalBanItem {
  user_id: string;
  username: string;
  reason: string | null;
  banned_at: string;
  banned_by_username: string | null;
}

export interface AdminRoomUpdate {
  name?: string;
  is_private?: boolean;
  tags?: string[];
}

const GUEST_STORAGE_KEY = "fastwatch_guest";

export function loadGuestSession(): GuestSession | null {
  const raw = localStorage.getItem(GUEST_STORAGE_KEY);
  if (!raw) {return null;}
  try {
    return JSON.parse(raw) as GuestSession;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestSession): void {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(session));
}

export async function ensureGuestSession(): Promise<GuestSession> {
  const existing = loadGuestSession();
  if (existing) {return existing;}
  const session = await apiFetch<GuestSession>("/auth/guest", { method: "POST" });
  saveGuestSession(session);
  return session;
}
