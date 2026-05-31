import type { JoinRoomResponse } from "../api/client";
import type { RoomSession } from "../types/room";

const key = (roomId: string) => `fastwatch_room_${roomId}`;
const metaKey = (roomId: string) => `fastwatch_room_meta_${roomId}`;

export interface RoomMeta {
  name: string;
  tags: string[];
  isPrivate: boolean;
}

export function saveRoomSession(roomId: string, join: JoinRoomResponse): RoomSession {
  const session: RoomSession = {
    roomId,
    participantId: join.participant_id,
    displayName: join.display_name,
    isAdmin: join.is_admin,
    isGuest: join.is_guest,
    joined: true,
    playerState: join.player_state,
  };
  sessionStorage.setItem(key(roomId), JSON.stringify(session));
  saveRoomMeta(roomId, {
    name: join.room.name,
    tags: join.room.tags ?? [],
    isPrivate: join.room.is_private,
  });
  return session;
}

export function saveRoomMeta(roomId: string, meta: RoomMeta) {
  sessionStorage.setItem(metaKey(roomId), JSON.stringify(meta));
}

export function loadRoomMeta(roomId: string): RoomMeta | null {
  const raw = sessionStorage.getItem(metaKey(roomId));
  if (!raw) {return null;}
  try {
    return JSON.parse(raw) as RoomMeta;
  } catch {
    return null;
  }
}

export function loadRoomSession(roomId: string): RoomSession | null {
  const raw = sessionStorage.getItem(key(roomId));
  if (!raw) {return null;}
  try {
    const session = JSON.parse(raw) as RoomSession & { wsToken?: string };
    if (!session.joined && session.wsToken) {
      session.joined = true;
    }
    return session;
  } catch {
    return null;
  }
}

export function removeRoomSession(roomId: string) {
  sessionStorage.removeItem(key(roomId));
  sessionStorage.removeItem(metaKey(roomId));
}

export function updateRoomSessionPlayer(roomId: string, playerState: RoomSession["playerState"]) {
  const s = loadRoomSession(roomId);
  if (!s) {return;}
  s.playerState = playerState;
  sessionStorage.setItem(key(roomId), JSON.stringify(s));
}
